"""Shared helpers for reading YouTube HTML pages (one job: fetch + extract JSON blobs)."""
import json
import re
import subprocess

HEADERS = ["-H", "Accept-Language: en-US,en;q=0.9", "-H", "Cookie: SOCS=CAI; CONSENT=YES+1"]


def get(url: str, timeout: int = 30) -> str:
    out = subprocess.run(["curl", "-sL", "--max-time", str(timeout), *HEADERS, url],
                         capture_output=True, text=True)
    return out.stdout


def status(url: str) -> int:
    """HTTP status without following redirects (used for the /shorts/ check)."""
    out = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "20",
                          *HEADERS, url], capture_output=True, text=True)
    return int(out.stdout or 0)


def blob(html: str, var: str):
    """Extract `var X = {...};` JSON assigned in a <script> tag."""
    m = re.search(r"(?:var |window\[\")" + re.escape(var) + r"(?:\"\])? = (\{.*?\});(?:</script>|var )", html, re.S)
    return json.loads(m.group(1)) if m else None


def walk(obj, key):
    """Yield every value stored under `key` anywhere in a nested JSON structure."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == key:
                yield v
            yield from walk(v, key)
    elif isinstance(obj, list):
        for v in obj:
            yield from walk(v, key)


def parse_count(text: str) -> int:
    """'1,234 views' / '12K views' / '1.2M views' -> int."""
    if not text:
        return 0
    t = text.replace(",", "").split()[0]
    mult = {"K": 1e3, "M": 1e6, "B": 1e9}.get(t[-1:].upper(), 1)
    try:
        return int(float(t.rstrip("KMBkmb")) * mult)
    except ValueError:
        return 0


def parse_length(text: str) -> int:
    """'1:02:03' -> seconds."""
    if not text:
        return 0
    secs = 0
    for part in text.split(":"):
        secs = secs * 60 + int(part)
    return secs
