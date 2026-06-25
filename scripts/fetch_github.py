#!/usr/bin/env python3
"""Fetch GitHub public repos → _data/github_repos.yml"""

import os
import sys
import yaml
import requests

USER = "sin1n24"
OUTPUT = os.path.join(os.path.dirname(__file__), "..", "_data", "github_repos.yml")

# Repos covered by other sections or not worth showcasing
EXCLUDE = {
    "sin1n24.github.io", "sin1n24", "testLinks",
    "MiniKawaRobo",     # in 企画 section
    "RobotS3RCam",      # in ロボット section
    "LumiGlyph",        # in 作品 (ProtoPedia) section
    "match-video-editor",
    "gas-stock-logger",
    "QRGunman",         # predecessor of QRevolver
    "JimaCup7",         # event page with no description
}


def fetch_repos():
    token = os.environ.get("GITHUB_TOKEN", "")
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"

    resp = requests.get(
        f"https://api.github.com/users/{USER}/repos",
        params={"per_page": 100, "sort": "updated", "type": "public"},
        headers=headers,
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json()


def process(repos):
    items = []
    for r in repos:
        if r["name"] in EXCLUDE or r.get("private"):
            continue
        if not r.get("homepage") and not r.get("description"):
            continue

        homepage = (r.get("homepage") or "").strip()
        url = homepage if homepage else r["html_url"]

        tags = []
        if r.get("language"):
            tags.append(r["language"])

        items.append({
            "title": r["name"],
            "url": url,
            "github_url": r["html_url"],
            "image": "",
            "description": (r.get("description") or "").strip(),
            "tags": tags,
            "updated_at": r["updated_at"][:10],
        })

    # repos with a distinct homepage come first
    items.sort(key=lambda x: (x["url"] == x["github_url"], x["updated_at"]), reverse=False)
    return items


def load_existing():
    try:
        with open(OUTPUT, encoding="utf-8") as f:
            return yaml.safe_load(f) or []
    except FileNotFoundError:
        return []


def main():
    try:
        repos = fetch_repos()
    except Exception as e:
        print(f"ERROR fetching GitHub repos: {e}", file=sys.stderr)
        sys.exit(1)

    items = process(repos)
    if not items:
        print("WARNING: No repos returned — keeping existing data", file=sys.stderr)
        sys.exit(0)

    # Preserve manual description overrides from existing file
    existing = {it["title"]: it for it in load_existing()}
    for item in items:
        old = existing.get(item["title"], {})
        if not item["description"] and old.get("description"):
            item["description"] = old["description"]
        if old.get("image"):
            item["image"] = old["image"]

    with open(OUTPUT, "w", encoding="utf-8") as f:
        yaml.dump(items, f, allow_unicode=True, sort_keys=False, default_flow_style=False)

    print(f"Updated {OUTPUT} with {len(items)} repos")


if __name__ == "__main__":
    main()
