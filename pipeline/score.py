"""Filter, categorize and score merged videos; write the page's data file.

Input: data/merged.json + channel tabs + channels.json. Output: data/site.json.
Rules and thresholds live in rules.py; this file only applies them.
"""
import json
import re
import statistics
from datetime import datetime, timedelta
from pathlib import Path

import rules
from config import NOW, ROOT, load


def typical_views(cid: str, tabs, streams, feeds) -> tuple:
    """Median views of the channel's non-Short videos that are at least 2 days old."""
    seen = {}
    for v in tabs.get(cid, []) + streams.get(cid, []):
        if v["views"] and not any(k in (v.get("ago") or "") for k in ("minute", "hour", "1 day")):
            seen[v["id"]] = v["views"]
    for e in feeds[cid]["entries"]:  # exact dates: drop anything younger than 48h
        age = NOW - datetime.fromisoformat(e["published"])
        if age < timedelta(hours=rules.BASELINE_MIN_AGE_H):
            seen.pop(e["id"], None)
        elif e["views"] and "#short" not in e["title"].lower():
            seen.setdefault(e["id"], e["views"])
    vals = sorted(seen.values())
    return (int(statistics.median(vals)) if vals else 0), len(vals)


def is_barca(v, channel_name: str) -> bool:
    if channel_name in rules.ALWAYS_BARCA:
        return True
    if rules.NOT_BARCA.search(v["title"]):
        return False
    first_line = (v.get("description") or "").split("\n")[0]
    return bool(rules.BARCA_TERMS.search(v["title"]) or rules.BARCA_TERMS.search(first_line))


def section(v, channel_name: str, group: str) -> str:
    t = v["title"]
    if group == "podcast" or rules.PODCAST.search(t) or rules.CHANNEL_SECTION.get(channel_name) == "podcasts":
        return "podcasts"
    if rules.HIGHLIGHT.search(t) or rules.CHANNEL_SECTION.get(channel_name) == "highlights":
        return "highlights"
    if rules.NEWS.search(t) or rules.CHANNEL_SECTION.get(channel_name) == "news":
        return "news"
    if channel_name == "FC Barcelona":  # matchday shows and previews are talk; the rest is club news
        return "talk" if re.search(r"preview|bar[cç]a live|un dia de partit", t, re.I) else "news"
    return "talk"


def story_of(title: str):
    for s in rules.STORIES:
        if s["re"].search(title) and (s["signal_re"] is None or s["signal_re"].search(title)):
            return s["id"]
    return None


def short_description(text: str) -> str:
    """First ~400 chars of the feed description, without link-dump lines."""
    lines = [l.strip() for l in (text or "").splitlines()]
    keep = [l for l in lines if l and not re.match(r"^(https?://|www\.|#|@)", l)]
    out = "\n".join(keep)
    return out[:400].rsplit(" ", 1)[0] + "…" if len(out) > 400 else out


def main() -> None:
    channels = {c["id"]: c for c in json.loads((ROOT / "channels.json").read_text())}
    feeds, tabs, streams = load("feeds.json"), load("tabs.json"), load("tab_streams.json")
    merged = load("merged.json")

    kept, dropped = [], []
    for v in merged:
        ch = channels[v["channel"]]
        if v["views"] == 0:  # live right now or scheduled: nothing to rank yet
            continue
        if not is_barca(v, ch["name"]):
            dropped.append(f'{ch["name"]}: {v["title"][:80]}')
            continue
        kept.append({
            "id": v["id"], "c": v["channel"], "t": v["title"].strip(),
            "p": v["published"][:16] + "Z" if v["date_exact"] else v["published"][:10],
            "exact": v["date_exact"], "views": v["views"], "len": v["length"],
            "live": v["kind"] == "stream",
            "sec": section(v, ch["name"], ch["group"]),
            "story": story_of(v["title"]),
            "d": short_description(v.get("description")),
        })

    # Channel baselines and breakout ratios.
    chan_out = {}
    for cid in {k["c"] for k in kept}:
        med, n = typical_views(cid, tabs, streams, feeds)
        chan_out[cid] = {"name": channels[cid]["name"], "group": channels[cid]["group"],
                         "lang": channels[cid]["lang"], "typical": med, "sample": n,
                         "found": channels[cid].get("found", False)}
    for k in kept:
        med = chan_out[k["c"]]["typical"]
        k["ratio"] = round(k["views"] / med, 2) if med else None
        k["breakout"] = bool(k["ratio"] and k["ratio"] >= rules.BREAKOUT_RATIO
                             and k["views"] >= rules.BREAKOUT_MIN_VIEWS)

    # Stories: keep only those covered by enough different channels.
    stories = []
    for s in rules.STORIES:
        vids = [k for k in kept if k["story"] == s["id"]]
        chans = {k["c"] for k in vids}
        if len(chans) >= rules.STORY_MIN_CHANNELS:
            stories.append({"id": s["id"], "label": s["label"], "kind": s["kind"], "channels": len(chans),
                            "videos": len(vids), "latest": max(k["p"] for k in vids)})
    live_ids = {s["id"] for s in stories}
    for k in kept:
        if k["story"] not in live_ids:
            k["story"] = None

    active = set(load("active.json"))
    quiet = [{"name": c["name"], "id": c["id"]} for c in channels.values()
             if c["id"] not in active and not c.get("candidate")]
    # Posted recently, but nothing that counts: only Shorts, streams not yet aired, or off-topic.
    filtered = [{"name": c["name"], "id": c["id"]} for c in channels.values()
                if c["id"] in active and c["id"] not in chan_out]
    site = {
        "snapshot": NOW.isoformat(),
        "rules": {"breakout": rules.BREAKOUT_RATIO, "minViews": rules.BREAKOUT_MIN_VIEWS, "storyMin": rules.STORY_MIN_CHANNELS,
                  "longMin": rules.LONG_SECONDS // 60, "windowDays": 14},
        "channels": chan_out, "stories": sorted(stories, key=lambda s: -s["channels"]),
        "quiet": quiet, "filtered": filtered, "videos": sorted(kept, key=lambda k: k["p"], reverse=True),
    }
    (ROOT / "data/site.json").write_text(json.dumps(site, ensure_ascii=False))
    print(len(kept), "videos kept,", len(dropped), "dropped as non-Barça")
    print("breakouts:", sum(k["breakout"] for k in kept))
    print("sections:", {s: sum(k["sec"] == s for k in kept) for s in ("highlights", "talk", "podcasts", "news")})
    print("longs:", sum(k["len"] > rules.LONG_SECONDS for k in kept))
    for s in site["stories"]:
        print(f'  story {s["label"]}: {s["channels"]} channels, {s["videos"]} videos')
    for cid, c in sorted(chan_out.items(), key=lambda x: x[1]["name"]):
        print(f'  {c["name"]:28} typical {c["typical"]:>8} (n={c["sample"]})')
    print("quiet:", [q["name"] for q in quiet], "| only Shorts/off-topic:", [q["name"] for q in filtered])
    (ROOT / "data/dropped.txt").write_text("\n".join(dropped))


if __name__ == "__main__":
    main()
