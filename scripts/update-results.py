"""Validate a draw record and atomically update public/data/results.json.

Usage: python scripts/update-results.py incoming-result.json
The incoming file must contain one JSON object with issue, date, six numbers,
and one special number. This script does not fetch unknown external URLs.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "data" / "results.json"


def validate(record: dict) -> dict:
    required = {"issue", "date", "numbers", "special"}
    if not required.issubset(record):
        raise ValueError("缺少必要字段：issue、date、numbers 或 special")
    if not isinstance(record["issue"], str) or not record["issue"].isdigit():
        raise ValueError("期号必须为数字字符串")
    datetime.strptime(record["date"], "%Y-%m-%d")
    numbers = record["numbers"]
    if not isinstance(numbers, list) or len(numbers) != 6:
        raise ValueError("正码数量必须等于 6")
    all_numbers = numbers + [record["special"]]
    if any(not isinstance(value, int) or isinstance(value, bool) or value < 1 or value > 49 for value in all_numbers):
        raise ValueError("所有号码必须为 1 至 49 的整数")
    if len(set(all_numbers)) != 7:
        raise ValueError("同一期的 7 个号码不得重复")
    return {"issue": record["issue"], "date": record["date"], "numbers": numbers, "special": record["special"]}


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("用法：python scripts/update-results.py incoming-result.json")
    incoming = Path(sys.argv[1]).resolve()
    record = validate(json.loads(incoming.read_text(encoding="utf-8")))
    existing = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else []
    records = [record] + [item for item in existing if item.get("issue") != record["issue"]]
    records.sort(key=lambda item: item["issue"], reverse=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    file_descriptor, temporary_name = tempfile.mkstemp(prefix="results-", suffix=".json", dir=OUTPUT.parent)
    try:
        with os.fdopen(file_descriptor, "w", encoding="utf-8") as handle:
            json.dump(records, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_name, OUTPUT)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)
    print(f"已验证并更新第 {record['issue']} 期")


if __name__ == "__main__":
    main()
