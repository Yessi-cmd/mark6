"""Synchronise validated Mark Six draw results from the HKJC results service.

The browser never calls HKJC directly. This server-side utility fetches the
same results data used by the HKJC results page, validates every draw, merges it
with the local archive, and atomically replaces the public JSON file.

Examples:
  python3 scripts/sync_official_results.py --last-n 30
  python3 scripts/sync_official_results.py --start-date 1993-01-01 --replace
  python3 scripts/sync_official_results.py --last-n 10 --check
"""

from __future__ import annotations

import argparse
import gzip
import json
import os
import sys
import tempfile
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from pathlib import Path
from time import sleep
from typing import Any, Iterable
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "public" / "data" / "results.json"
OFFICIAL_ENDPOINT = "https://info.cld.hkjc.com/graphql/base/"
HONG_KONG_TIMEZONE = ZoneInfo("Asia/Hong_Kong")

# The official endpoint allow-lists persisted query shapes. Keep this selection
# aligned with the query used by the HKJC Mark Six results page.
OFFICIAL_QUERY = """
fragment lotteryDrawsFragment on LotteryDraw {
  id
  year
  no
  openDate
  closeDate
  drawDate
  status
  snowballCode
  snowballName_en
  snowballName_ch
  lotteryPool {
    sell
    status
    totalInvestment
    jackpot
    unitBet
    estimatedPrize
    derivedFirstPrizeDiv
    lotteryPrizes {
      type
      winningUnit
      dividend
    }
  }
  drawResult {
    drawnNo
    xDrawnNo
  }
}

query marksixResult(
  $lastNDraw: Int
  $startDate: String
  $endDate: String
  $drawType: LotteryDrawType
) {
  lotteryDraws(
    lastNDraw: $lastNDraw
    startDate: $startDate
    endDate: $endDate
    drawType: $drawType
  ) {
    ...lotteryDrawsFragment
  }
}
""".strip()


class SyncError(RuntimeError):
    """Raised when official data cannot be safely published."""


def hong_kong_today() -> date:
    """Return the calendar date used by HKJC, regardless of server timezone."""
    return datetime.now(HONG_KONG_TIMEZONE).date()


def parse_date(value: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as error:
        raise argparse.ArgumentTypeError("日期格式必须为 YYYY-MM-DD") from error


def validate_record(record: Any) -> dict[str, Any]:
    if not isinstance(record, dict):
        raise SyncError("开奖记录必须是 JSON 对象")

    required = {"issue", "date", "numbers", "special"}
    if not required.issubset(record):
        raise SyncError("开奖记录缺少 issue、date、numbers 或 special")

    issue = record["issue"]
    if not isinstance(issue, str) or len(issue) != 7 or not issue.isdigit():
        raise SyncError(f"无效期号：{issue!r}")

    draw_date = record["date"]
    if not isinstance(draw_date, str):
        raise SyncError(f"第 {issue} 期的日期不是字符串")
    try:
        parsed_date = datetime.strptime(draw_date, "%Y-%m-%d").date()
    except ValueError as error:
        raise SyncError(f"第 {issue} 期的日期无效：{draw_date!r}") from error
    if parsed_date.year != int(issue[:4]):
        raise SyncError(f"第 {issue} 期的年份与开奖日期不一致")
    if parsed_date > hong_kong_today():
        raise SyncError(f"第 {issue} 期的开奖日期位于未来")

    numbers = record["numbers"]
    special = record["special"]
    if not isinstance(numbers, list) or len(numbers) != 6:
        raise SyncError(f"第 {issue} 期必须有 6 个正码")
    all_numbers = [*numbers, special]
    if any(
        not isinstance(value, int)
        or isinstance(value, bool)
        or value < 1
        or value > 49
        for value in all_numbers
    ):
        raise SyncError(f"第 {issue} 期含有 1 至 49 以外的号码")
    if len(set(all_numbers)) != 7:
        raise SyncError(f"第 {issue} 期的 7 个号码存在重复")

    return {
        "issue": issue,
        "date": draw_date,
        "numbers": numbers,
        "special": special,
    }


def official_draw_to_record(draw: Any) -> dict[str, Any] | None:
    if not isinstance(draw, dict):
        raise SyncError("官方接口返回了无效的开奖记录")
    if draw.get("status") != "Result":
        return None

    year = draw.get("year")
    number = draw.get("no")
    draw_date = draw.get("drawDate")
    result = draw.get("drawResult")
    if (
        not isinstance(year, str)
        or len(year) != 4
        or not year.isdigit()
        or not isinstance(number, int)
        or isinstance(number, bool)
        or number < 1
        or number > 999
        or not isinstance(draw_date, str)
        or len(draw_date) < 10
        or not isinstance(result, dict)
    ):
        raise SyncError("官方接口返回了字段不完整的开奖结果")

    return validate_record(
        {
            "issue": f"{year}{number:03d}",
            "date": draw_date[:10],
            "numbers": result.get("drawnNo"),
            "special": result.get("xDrawnNo"),
        }
    )


def request_official(
    variables: dict[str, Any], timeout: int, retries: int
) -> list[dict[str, Any]]:
    payload = json.dumps(
        {"query": OFFICIAL_QUERY, "variables": variables},
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    request = urllib.request.Request(
        OFFICIAL_ENDPOINT,
        data=payload,
        headers={
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "Content-Type": "application/json",
            "Origin": "https://bet.hkjc.com",
            "Referer": "https://bet.hkjc.com/ch/marksix/results",
            "User-Agent": "SafeMark6-results-sync/1.0 (+https://mark6.norliva.top)",
        },
        method="POST",
    )

    body: bytes | None = None
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                body = response.read()
                if response.headers.get("Content-Encoding", "").lower() == "gzip":
                    body = gzip.decompress(body)
            break
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            last_error = error
            if attempt < retries:
                sleep(2**attempt)
    if body is None:
        raise SyncError(f"无法连接官方开奖数据服务：{last_error}") from last_error

    try:
        document = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise SyncError("官方开奖数据不是有效 JSON") from error

    if not isinstance(document, dict):
        raise SyncError("官方开奖接口返回了无效响应")
    if document.get("errors"):
        messages = "; ".join(
            str(item.get("message", item)) if isinstance(item, dict) else str(item)
            for item in document["errors"]
        )
        raise SyncError(f"官方开奖接口报错：{messages}")

    data = document.get("data")
    draws = data.get("lotteryDraws") if isinstance(data, dict) else None
    if not isinstance(draws, list):
        raise SyncError("官方开奖接口没有返回 lotteryDraws 数组")

    records = []
    for draw in draws:
        record = official_draw_to_record(draw)
        if record is not None:
            records.append(record)
    return records


def date_windows(start: date, end: date) -> Iterable[tuple[date, date]]:
    # The official results search accepts a maximum window of 90 calendar days.
    cursor = start
    while cursor <= end:
        window_end = min(cursor + timedelta(days=89), end)
        yield cursor, window_end
        cursor = window_end + timedelta(days=1)


def fetch_records(args: argparse.Namespace) -> list[dict[str, Any]]:
    if args.start_date:
        end_date = args.end_date or hong_kong_today()
        if args.start_date > end_date:
            raise SyncError("开始日期不得晚于结束日期")
        windows = list(date_windows(args.start_date, end_date))

        def fetch_window(window: tuple[date, date]) -> list[dict[str, Any]]:
            start, end = window
            return request_official(
                {
                    "lastNDraw": None,
                    "startDate": start.strftime("%Y%m%d"),
                    "endDate": end.strftime("%Y%m%d"),
                    "drawType": "All",
                },
                args.timeout,
                args.retries,
            )

        print(
            f"按 {len(windows)} 个日期区间读取官方记录："
            f"{args.start_date.isoformat()} 至 {end_date.isoformat()}",
            file=sys.stderr,
        )
        records: list[dict[str, Any]] = []
        with ThreadPoolExecutor(max_workers=args.workers) as executor:
            for window_records in executor.map(fetch_window, windows):
                records.extend(window_records)
        return records

    return request_official(
        {
            "lastNDraw": args.last_n,
            "startDate": None,
            "endDate": None,
            "drawType": "All",
        },
        args.timeout,
        args.retries,
    )


def deduplicate(records: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    by_issue: dict[str, dict[str, Any]] = {}
    for raw_record in records:
        record = validate_record(raw_record)
        issue = record["issue"]
        previous = by_issue.get(issue)
        if previous is not None and previous != record:
            raise SyncError(f"第 {issue} 期出现互相冲突的开奖记录")
        by_issue[issue] = record
    return sorted(
        by_issue.values(),
        key=lambda item: (item["date"], item["issue"]),
        reverse=True,
    )


def load_existing(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SyncError(f"现有数据文件无法读取：{path}") from error
    if not isinstance(document, list):
        raise SyncError("现有数据文件必须是 JSON 数组")
    return deduplicate(document)


def serialize(records: list[dict[str, Any]]) -> str:
    return json.dumps(records, ensure_ascii=False, indent=2) + "\n"


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix="results-", suffix=".json", dir=path.parent
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary_name, 0o644)
        os.replace(temporary_name, path)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="同步并验证香港马会六合彩开奖记录")
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--last-n", type=int, default=30, help="读取最近 N 期开奖结果")
    source.add_argument("--start-date", type=parse_date, help="按日期导入，格式 YYYY-MM-DD")
    parser.add_argument("--end-date", type=parse_date, help="日期导入的结束日期，默认为今天")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="输出 JSON 路径")
    parser.add_argument("--replace", action="store_true", help="只保留本次官方查询返回的记录")
    parser.add_argument("--check", action="store_true", help="仅获取和校验，不写入文件")
    parser.add_argument("--timeout", type=int, default=30, help="单次官方请求超时秒数")
    parser.add_argument("--retries", type=int, default=2, help="网络失败后的重试次数")
    parser.add_argument("--workers", type=int, default=3, help="历史导入的并发请求数")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.end_date and not args.start_date:
        raise SyncError("--end-date 必须与 --start-date 一起使用")
    if args.last_n is not None and not 1 <= args.last_n <= 500:
        raise SyncError("--last-n 必须介于 1 至 500")
    if args.timeout < 5:
        raise SyncError("请求超时不得少于 5 秒")
    if not 0 <= args.retries <= 5:
        raise SyncError("重试次数必须介于 0 至 5")
    if not 1 <= args.workers <= 6:
        raise SyncError("并发请求数必须介于 1 至 6")

    fetched = deduplicate(fetch_records(args))
    if not fetched:
        raise SyncError("官方接口没有返回任何已开奖记录，停止更新")

    if args.replace:
        merged = fetched
    else:
        existing = load_existing(args.output)
        official_issues = {record["issue"] for record in fetched}
        merged = deduplicate(
            [*fetched, *(record for record in existing if record["issue"] not in official_issues)]
        )

    latest = merged[0]
    message = (
        f"已核验 {len(fetched)} 期官方记录；归档共 {len(merged)} 期；"
        f"最新为第 {latest['issue']} 期（{latest['date']}）"
    )
    if args.check:
        print(message + "；检查模式未写入")
        return 0

    content = serialize(merged)
    previous_content = args.output.read_text(encoding="utf-8") if args.output.exists() else None
    if previous_content == content:
        print(message + "；数据无变化")
        return 0

    atomic_write(args.output, content)
    print(message + f"；已更新 {args.output}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SyncError as error:
        print(f"同步失败：{error}", file=sys.stderr)
        raise SystemExit(1) from error
