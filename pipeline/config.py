"""Shared settings for every pipeline step.

NOW is the snapshot time: the real current time, or BW_NOW (ISO 8601) to rebuild an
old snapshot exactly. Every step imports NOW from here so one run uses one clock.
"""
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NOW = (datetime.fromisoformat(os.environ["BW_NOW"]) if os.environ.get("BW_NOW")
       else datetime.now(timezone.utc).replace(second=0, microsecond=0))
WINDOW = timedelta(days=14)


def load(name: str):
    return json.loads((ROOT / "data" / name).read_text())


def save(name: str, obj, indent=1) -> None:
    (ROOT / "data").mkdir(exist_ok=True)
    (ROOT / "data" / name).write_text(json.dumps(obj, ensure_ascii=False, indent=indent))
