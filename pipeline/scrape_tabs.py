"""Read each active channel's Videos tab: up to ~30 regular uploads with views + length.

Used for (a) the channel's typical-views baseline and (b) uploads the 15-item feed missed.
Output: data/tabs.json — {channel_id: [{id, title, views, length, ago}]}
"""
import json
import sys
import time
from config import ROOT
from yt_page import blob, get, parse_count, parse_length, walk


def text_of(node) -> str:
    if not node:
        return ""
    return node.get("simpleText") or "".join(r.get("text", "") for r in node.get("runs", []))


def from_lockup(lv: dict) -> dict:
    """YouTube's current tile format (lockupViewModel)."""
    meta = lv["metadata"]["lockupMetadataViewModel"]
    rows = meta.get("metadata", {}).get("contentMetadataViewModel", {}).get("metadataRows", [])
    parts = [p for r in rows for p in r.get("metadataParts", [])]
    labels = [p.get("accessibilityLabel") or p.get("text", {}).get("content", "") for p in parts]
    views = next((l for l in labels if "view" in l), "")
    ago = next((l for l in labels if "ago" in l), "")
    badge = next(walk(lv.get("contentImage", {}), "thumbnailBadgeViewModel"), {})
    return {
        "id": lv.get("contentId"),
        "title": meta.get("title", {}).get("content", ""),
        "views": parse_count(views.replace(" thousand", "K").replace(" million", "M")),
        "length": parse_length(badge.get("text", "")) if ":" in badge.get("text", "") else 0,
        "ago": ago,
    }


def from_renderer(vr: dict) -> dict:
    """Older tile format (videoRenderer), kept as a fallback."""
    return {
        "id": vr.get("videoId"),
        "title": text_of(vr.get("title")),
        "views": parse_count(text_of(vr.get("viewCountText"))),
        "length": parse_length(text_of(vr.get("lengthText"))),
        "ago": text_of(vr.get("publishedTimeText")),
    }


def scrape(cid: str, tab: str = "videos") -> tuple:
    data = blob(get(f"https://www.youtube.com/channel/{cid}/{tab}"), "ytInitialData") or {}
    if tab == "shorts":  # only the IDs matter: they mark a feed entry as a Short
        ids = sorted({e["videoId"] for e in walk(data, "reelWatchEndpoint") if "videoId" in e})
        return cid, [{"id": i} for i in ids]
    videos = [from_lockup(lv) for lv in walk(data, "lockupViewModel")
              if lv.get("contentType") == "LOCKUP_CONTENT_TYPE_VIDEO"]
    videos += [from_renderer(vr) for vr in walk(data, "videoRenderer")]
    return cid, videos


def main() -> None:
    tab = sys.argv[1] if len(sys.argv) > 1 else "videos"
    ids = json.loads((ROOT / "data/active.json").read_text())
    tabs = {}
    for cid in ids:  # sequential + pause: stay well under YouTube's rate limits
        tabs[cid] = scrape(cid, tab)[1]
        time.sleep(1.5)
    name = "tabs.json" if tab == "videos" else f"tab_{tab}.json"
    (ROOT / "data" / name).write_text(json.dumps(tabs, ensure_ascii=False, indent=1))
    for cid, vids in tabs.items():
        print(f"{len(vids):3d} {cid} {vids[-1].get('ago', '') if vids else '-'}")


if __name__ == "__main__":
    main()
