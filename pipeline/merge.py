"""Merge feeds + channel tabs into one record per video from the last 14 days.

Video type comes from which tab lists it (Videos / Live / Shorts), so no per-video
page requests are needed. Output: data/merged.json
"""
import re
from datetime import datetime, timedelta

from config import NOW, WINDOW, load, save


def ago_to_date(ago: str):
    """'3 days ago' / '5 hours ago' / '1 week ago' / 'Streamed 2 days ago' -> approx datetime."""
    m = re.search(r"(\d+)\s+(second|minute|hour|day|week|month|year)", ago or "")
    if not m:
        return None
    n, unit = int(m.group(1)), m.group(2)
    days = {"second": 1 / 86400, "minute": 1 / 1440, "hour": 1 / 24, "day": 1, "week": 7,
            "month": 30, "year": 365}[unit] * n
    if unit == "week":  # "1 week ago" = 7-13 days, "2 weeks ago" = 14-20: use the middle
        days += 3
    return NOW - timedelta(days=days)


def main() -> None:
    feeds, tabs, streams, shorts = (load(n) for n in
                                    ("feeds.json", "tabs.json", "tab_streams.json", "tab_shorts.json"))
    active = load("active.json")
    merged, stats = [], {"short": 0, "upcoming": 0, "unknown": 0}
    for cid in active:
        tab_v = {v["id"]: v for v in tabs.get(cid, [])}
        tab_s = {v["id"]: v for v in streams.get(cid, [])}
        short_ids = {v["id"] for v in shorts.get(cid, [])}
        feed = {e["id"]: e for e in feeds[cid]["entries"]}
        ids = list(dict.fromkeys(list(feed) + list(tab_v) + list(tab_s)))
        for vid in ids:
            f, tv, ts = feed.get(vid), tab_v.get(vid), tab_s.get(vid)
            tab = tv or ts
            exact = datetime.fromisoformat(f["published"]) if f else None
            # "1 week ago" spans 7-13 days, so it counts as in-window; "2 weeks ago" never does
            approx = ago_to_date(tab["ago"]) if tab else None
            when = exact or approx
            if when is None or NOW - when > WINDOW:
                continue
            title = (f or tab)["title"]
            if vid in short_ids or "#short" in title.lower():
                stats["short"] += 1
                continue
            if ts and (not ts["ago"] or "Scheduled" in ts["ago"]) and (f or {}).get("views", 0) == 0:
                stats["upcoming"] += 1  # scheduled stream: nothing to watch yet
                continue
            # A channel without a Live tab serves its Videos tab at /streams, so only a
            # "Streamed ..." label proves a stream.
            if tv:
                kind = "video"
            elif ts:
                kind = "stream" if "Streamed" in (ts.get("ago") or "") else "video"
            else:
                kind = "unknown"
            stats["unknown"] += kind == "unknown"
            merged.append({
                "id": vid, "channel": cid, "title": title,
                "description": (f or {}).get("description", ""),
                "published": (exact or approx).isoformat(),
                "date_exact": bool(exact),
                "views": (f or {}).get("views") or (tab or {}).get("views", 0),
                "length": (tab or {}).get("length", 0),
                "kind": kind,
            })
    save("merged.json", merged)
    print(len(merged), "kept;", stats)


if __name__ == "__main__":
    main()
