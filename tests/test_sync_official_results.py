from __future__ import annotations

import importlib.util
import unittest
from datetime import date, datetime
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "sync_official_results", ROOT / "scripts" / "sync_official_results.py"
)
assert SPEC and SPEC.loader
sync = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(sync)


class OfficialResultsSyncTests(unittest.TestCase):
    def test_uses_hong_kong_calendar_date(self) -> None:
        hong_kong_now = datetime(2026, 8, 13, 6, 0, tzinfo=sync.HONG_KONG_TIMEZONE)
        with patch.object(sync, "datetime") as mocked_datetime:
            mocked_datetime.now.return_value = hong_kong_now
            self.assertEqual(sync.hong_kong_today(), date(2026, 8, 13))
            mocked_datetime.now.assert_called_once_with(sync.HONG_KONG_TIMEZONE)

    def test_validates_a_complete_record(self) -> None:
        record = {
            "issue": "2026087",
            "date": "2026-08-11",
            "numbers": [11, 19, 28, 36, 43, 48],
            "special": 13,
        }
        self.assertEqual(sync.validate_record(record), record)

    def test_rejects_duplicate_numbers(self) -> None:
        with self.assertRaisesRegex(sync.SyncError, "存在重复"):
            sync.validate_record(
                {
                    "issue": "2026087",
                    "date": "2026-08-11",
                    "numbers": [11, 19, 28, 36, 43, 48],
                    "special": 11,
                }
            )

    def test_converts_the_official_shape(self) -> None:
        result = sync.official_draw_to_record(
            {
                "year": "2026",
                "no": 87,
                "drawDate": "2026-08-11+08:00",
                "status": "Result",
                "drawResult": {
                    "drawnNo": [11, 19, 28, 36, 43, 48],
                    "xDrawnNo": 13,
                },
            }
        )
        self.assertEqual(result["issue"], "2026087")
        self.assertEqual(result["date"], "2026-08-11")

    def test_splits_history_into_official_search_windows(self) -> None:
        windows = list(sync.date_windows(date(2026, 1, 1), date(2026, 4, 1)))
        self.assertEqual(
            windows,
            [
                (date(2026, 1, 1), date(2026, 3, 31)),
                (date(2026, 4, 1), date(2026, 4, 1)),
            ],
        )


if __name__ == "__main__":
    unittest.main()
