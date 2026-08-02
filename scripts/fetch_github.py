#!/usr/bin/env python3
"""Fetch GitHub public repos → _data/github_repos.yml"""

import base64
import os
import re
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
    "QRGunman",         # predecessor of QRevolver
    "JimaCup7",         # event page with no description
    "serval",           # in 企画 section
    "Links",            # in ソフトウエア section
    "AvaGotchi",        # in ソフトウエア section
    "ORBITAL_DRIFT",    # in ソフトウエア section
    "KawaroboVR",       # linked from かわロボVR card as 使ってみる; Simba (legacy version) still shown here
    "QRevolver",        # not worth showcasing
}

# READMEのMarkdown画像記法 ![alt](url) の最初の1件を拾う
README_IMAGE_RE = re.compile(r'!\[[^\]]*\]\((https?://[^)\s]+)\)')


def build_headers():
    token = os.environ.get("GITHUB_TOKEN", "")
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"
    return headers


def fetch_repos(headers):
    resp = requests.get(
        f"https://api.github.com/users/{USER}/repos",
        params={"per_page": 100, "sort": "updated", "type": "public"},
        headers=headers,
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json()


def fetch_readme_image(repo_name, headers):
    """READMEに埋め込まれた画像（デモ動画のYouTubeサムネイル等）があれば最初の1件のURLを返す"""
    try:
        resp = requests.get(
            f"https://api.github.com/repos/{USER}/{repo_name}/readme",
            headers=headers,
            timeout=10,
        )
        if resp.status_code != 200:
            return None
        content = base64.b64decode(resp.json()["content"]).decode("utf-8", errors="ignore")
        match = README_IMAGE_RE.search(content)
        return match.group(1) if match else None
    except Exception:
        return None


def process(repos, headers):
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

        # READMEの作例画像を優先、無ければGitHub自動生成のOGP画像にフォールバック
        image = fetch_readme_image(r["name"], headers) or \
            f"https://opengraph.githubassets.com/1/{USER}/{r['name']}"

        items.append({
            "title": r["name"],
            "url": url,
            "github_url": r["html_url"],
            "image": image,
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
    headers = build_headers()

    try:
        repos = fetch_repos(headers)
    except Exception as e:
        print(f"ERROR fetching GitHub repos: {e}", file=sys.stderr)
        sys.exit(1)

    items = process(repos, headers)
    if not items:
        print("WARNING: No repos returned — keeping existing data", file=sys.stderr)
        sys.exit(0)

    # Preserve manual description/image overrides from existing file
    existing = {it["title"]: it for it in load_existing()}
    for item in items:
        old = existing.get(item["title"], {})
        if not item["description"] and old.get("description"):
            item["description"] = old["description"]
        if old.get("image_override"):
            item["image"] = old["image_override"]

    with open(OUTPUT, "w", encoding="utf-8") as f:
        yaml.dump(items, f, allow_unicode=True, sort_keys=False, default_flow_style=False)

    print(f"Updated {OUTPUT} with {len(items)} repos")


if __name__ == "__main__":
    main()
