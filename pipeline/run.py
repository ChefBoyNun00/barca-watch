"""Run the Barça Watch data pipeline and write web/data.json.

Usage:  python3 pipeline/run.py

Steps run in order with one shared clock and stop at the first failure.
A result with fewer than MIN_VIDEOS videos is treated as a blocked fetch: the
script exits non-zero and leaves web/data.json untouched, so the live site keeps
its last good data.
"""
import json
import os
import shutil
import subprocess
import sys

from config import NOW, ROOT

MIN_VIDEOS = 60  # below this, assume YouTube blocked the reads

STEPS = [
    ["fetch_feeds.py"],
    ["scrape_tabs.py", "videos"],
    ["scrape_tabs.py", "streams"],
    ["scrape_tabs.py", "shorts"],
    ["merge.py"],
    ["score.py"],
]


def run_step(args) -> None:
    print(f"== {' '.join(args)}", flush=True)
    env = {**os.environ, "BW_NOW": NOW.isoformat()}  # one clock for every step
    proc = subprocess.run([sys.executable, *args], cwd=ROOT / "pipeline", env=env)
    if proc.returncode != 0:
        sys.exit(f"step failed: {' '.join(args)}")


def main() -> None:
    for step in STEPS:
        run_step(step)
    site = json.loads((ROOT / "data/site.json").read_text())
    n = len(site["videos"])
    if n < MIN_VIDEOS:
        sys.exit(f"only {n} videos (minimum {MIN_VIDEOS}); keeping the previous web/data.json")
    shutil.copyfile(ROOT / "data/site.json", ROOT / "web/data.json")
    print(f"web/data.json: {n} videos, snapshot {site['snapshot']}")


if __name__ == "__main__":
    main()
