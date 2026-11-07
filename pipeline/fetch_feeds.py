"""Fetch every channel's YouTube RSS feed and save normalized entries.

Output: data/feeds.json and data/active.json — {channel_id: {"ok": bool, "title": str, "entries": [...]}}
Each entry: id, title, published (ISO), views (int), description.
One job: fetch + parse. Filtering/scoring lives in later scripts.
"""
import json
import subprocess
import sys
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from config import NOW, ROOT, WINDOW, save
FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id={}"
NS = {
    "a": "http://www.w3.org/2005/Atom",
    "yt": "http://www.youtube.com/xml/schemas/2015",
    "media": "http://search.yahoo.com/mrss/",
}


def fetch(url: str) -> str:
    out = subprocess.run(
        ["curl", "-sL", "--max-time", "30", url], capture_output=True, text=True
    )
    return out.stdout


def parse(xml_text: str) -> dict:
    root = ET.fromstring(xml_text)
    entries = []
    for e in root.findall("a:entry", NS):
        stats = e.find("media:group/media:community/media:statistics", NS)
        desc = e.find("media:group/media:description", NS)
        entries.append({
            "id": e.findtext("yt:videoId", namespaces=NS),
            "title": e.findtext("a:title", namespaces=NS),
            "published": e.findtext("a:published", namespaces=NS),
            "views": int(stats.get("views", 0)) if stats is not None else 0,
            "description": (desc.text or "")[:600] if desc is not None else "",
        })
    return {"title": root.findtext("a:title", namespaces=NS), "entries": entries}


def load(ch: dict) -> tuple:
    try:
        return ch["id"], {"ok": True, **parse(fetch(FEED_URL.format(ch["id"])))}
    except Exception as exc:  # report per channel, never abort the batch
        return ch["id"], {"ok": False, "error": str(exc), "entries": []}


def main() -> None:
    channels = json.loads((ROOT / "channels.json").read_text())
    with ThreadPoolExecutor(8) as pool:
        result = dict(pool.map(load, channels))
    save("feeds.json", result)
    # Active = posted anything in the window. Only these get their tabs read.
    active = [c["id"] for c in channels if any(
        NOW - datetime.fromisoformat(e["published"]) <= WINDOW for e in result[c["id"]]["entries"])]
    save("active.json", active)
    print(len(active), "active channels")
    for ch in channels:
        r = result[ch["id"]]
        print(f'{"OK " if r["ok"] else "ERR"} {len(r["entries"]):3d}  {ch["name"]}  ({r.get("title") or r.get("error")})')


if __name__ == "__main__":
    sys.exit(main())
