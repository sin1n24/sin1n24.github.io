#!/usr/bin/env python3
"""Scrape ProtoPedia user page → _data/protopedia_works.yml"""

import re
import sys
import os
import yaml
import requests
from bs4 import BeautifulSoup

USER_ID = "sin1"
URL = f"https://protopedia.net/prototyper/{USER_ID}"
OUTPUT = os.path.join(os.path.dirname(__file__), "..", "_data", "protopedia_works.yml")


def fetch_html():
    headers = {"User-Agent": "Mozilla/5.0 (compatible; site-data-updater/1.0)"}
    resp = requests.get(URL, headers=headers, timeout=20)
    resp.raise_for_status()
    return resp.text


def parse_works(html):
    soup = BeautifulSoup(html, "html.parser")
    works = []
    seen_hrefs = set()

    for a in soup.find_all("a", href=re.compile(r"^/prototype/\d+")):
        href = a["href"].split("?")[0]
        if href in seen_hrefs:
            continue
        seen_hrefs.add(href)

        # Title: first significant text in the anchor
        raw_text = a.get_text(separator=" ", strip=True)
        # Strip out icon text and counts (short fragments)
        title = " ".join(p for p in raw_text.split() if len(p) > 1 and not p.isdigit())
        if not title or len(title) > 120:
            continue

        # Image
        img_tag = a.find("img")
        image = ""
        if img_tag:
            src = img_tag.get("src", "")
            if src.startswith("/"):
                image = f"https://protopedia.net{src}"
            elif src.startswith("http"):
                image = src

        # Description: try sibling/parent text near the card
        desc = ""
        parent = a.parent
        for elem in parent.find_all(string=True, recursive=True):
            t = elem.strip()
            if t and t != title and len(t) > 15 and not re.match(r"^[\d\s完成]+$", t):
                desc = t[:120]
                break

        works.append({
            "title": title,
            "url": f"https://protopedia.net{href}",
            "image": image,
            "description": desc,
        })

    return works


def load_existing():
    try:
        with open(OUTPUT, encoding="utf-8") as f:
            return yaml.safe_load(f) or []
    except FileNotFoundError:
        return []


def main():
    try:
        html = fetch_html()
        works = parse_works(html)
    except Exception as e:
        print(f"ERROR fetching/parsing ProtoPedia: {e}", file=sys.stderr)
        sys.exit(1)

    if not works:
        print("WARNING: No prototype links found — keeping existing data", file=sys.stderr)
        sys.exit(0)

    # Merge: keep manual description/tags if scraper finds empty desc
    existing = {w["url"]: w for w in load_existing()}
    merged = []
    for w in works:
        old = existing.get(w["url"], {})
        if not w["description"] and old.get("description"):
            w["description"] = old["description"]
        if old.get("tags"):
            w["tags"] = old["tags"]
        merged.append(w)

    with open(OUTPUT, "w", encoding="utf-8") as f:
        yaml.dump(merged, f, allow_unicode=True, sort_keys=False, default_flow_style=False)

    print(f"Updated {OUTPUT} with {len(merged)} works")


if __name__ == "__main__":
    main()
