#!/usr/bin/env python3
"""
migrate_hatena.py — はてなブログ (Movable Type形式エクスポート) を
Astroブログ (src/content/blog/<slug>.md) 用のMarkdown記事に変換するCLI。

依存パッケージのインストールが必要です:
    pip install markdownify beautifulsoup4

使い方:
    python scripts/migrate_hatena.py <export.txt> [--limit N] [--out src/content/blog] [--dry-run]

詳細は scripts/README_hatena_migration.md を参照。
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional

try:
    from bs4 import BeautifulSoup, NavigableString, Tag
except ImportError:
    print(
        "エラー: beautifulsoup4 がインストールされていません。\n"
        "  pip install markdownify beautifulsoup4\n"
        "を実行してから再度お試しください。",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    from markdownify import markdownify as html_to_md
except ImportError:
    print(
        "エラー: markdownify がインストールされていません。\n"
        "  pip install markdownify beautifulsoup4\n"
        "を実行してから再度お試しください。",
        file=sys.stderr,
    )
    sys.exit(1)


HATENA_ENTRY_URL_BASE = "https://sin1n24.hatenablog.com/entry/"

# MT形式の区切り
ENTRY_SEP_RE = re.compile(r"^-{8}\s*$")
BLOCK_END_RE = re.compile(r"^-{5}\s*$")
FIELD_RE = re.compile(r"^([A-Z][A-Z ]*):\s?(.*)$")

# lazy-load画像などで実URLが入りうる属性の優先順位
# (lazy-load実装では src に placeholder/spacer画像が入り、data-* に実URLが
#  入っているケースが多いため data-* を優先し、src は最後のフォールバックとする)
IMG_SRC_CANDIDATE_ATTRS = [
    "data-src",
    "data-original-src",
    "data-original",
    "data-lazy-src",
    "data-hatena-image-src",
    "src",
]

PUBLISH_STATUSES = {"publish"}


@dataclass
class HatenaEntry:
    title: str = ""
    basename: str = ""
    date_raw: str = ""
    status: str = ""
    categories: List[str] = field(default_factory=list)
    body: str = ""


@dataclass
class ConvertedPost:
    slug: str
    title: str
    date_str: str
    categories: List[str]
    hatena_url: str
    body_md: str
    warnings: List[str] = field(default_factory=list)


def read_export_file(path: Path) -> str:
    """MTエクスポートファイルを読み込む。エンコーディングをいくつか試す。"""
    for enc in ("utf-8-sig", "utf-8", "cp932", "euc-jp"):
        try:
            return path.read_text(encoding=enc)
        except (UnicodeDecodeError, LookupError):
            continue
    # 最終手段: エラーを置換しつつUTF-8で読む
    return path.read_text(encoding="utf-8", errors="replace")


def parse_mt_file(text: str) -> List[HatenaEntry]:
    """MT形式テキストを HatenaEntry のリストにパースする。"""
    # 行末の\r除去、行単位で処理
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")

    entries: List[HatenaEntry] = []
    current_lines: List[str] = []

    def flush_entry(chunk_lines: List[str]) -> None:
        entry = parse_single_entry(chunk_lines)
        if entry is not None:
            entries.append(entry)

    for line in lines:
        if ENTRY_SEP_RE.match(line):
            if current_lines:
                flush_entry(current_lines)
                current_lines = []
            continue
        current_lines.append(line)

    if current_lines and any(l.strip() for l in current_lines):
        flush_entry(current_lines)

    return entries


def parse_single_entry(chunk_lines: List[str]) -> Optional[HatenaEntry]:
    entry = HatenaEntry()
    i = 0
    n = len(chunk_lines)
    found_any_field = False

    while i < n:
        line = chunk_lines[i]

        if not line.strip():
            i += 1
            continue

        m = FIELD_RE.match(line)
        if not m:
            # ヘッダとして解釈できない行はスキップ（不明な行）
            i += 1
            continue

        key = m.group(1).strip().upper()
        val = m.group(2)
        found_any_field = True

        if key == "BODY":
            # BODY: の次の行から、単独の "-----" 行までが本文
            body_lines: List[str] = []
            i += 1
            while i < n and not BLOCK_END_RE.match(chunk_lines[i]):
                body_lines.append(chunk_lines[i])
                i += 1
            entry.body = "\n".join(body_lines).strip("\n")
            # "-----" 区切り自体を読み飛ばす
            if i < n:
                i += 1
            # EXTENDED BODY / COMMENT 等、BODY以降のブロックは今回は不要なので
            # ここで打ち切る（後続ブロックがあっても無視する）
            break
        elif key == "TITLE":
            entry.title = val.strip()
            i += 1
        elif key == "BASENAME":
            entry.basename = val.strip()
            i += 1
        elif key == "DATE":
            entry.date_raw = val.strip()
            i += 1
        elif key == "STATUS":
            entry.status = val.strip()
            i += 1
        elif key == "CATEGORY":
            cat = val.strip()
            if cat:
                entry.categories.append(cat)
            i += 1
        else:
            # AUTHOR, ALLOW COMMENTS, CONVERT BREAKS 等、今回使わないフィールド
            i += 1

    if not found_any_field:
        return None
    return entry


def basename_to_slug(basename: str) -> str:
    """'2026/07/12/025929' -> '2026-07-12-025929'"""
    parts = [p for p in basename.strip().split("/") if p]
    if len(parts) >= 4:
        return "-".join(parts[:4])
    # 想定外の形式の場合はそのままハイフン連結（フォールバック）
    return "-".join(parts) if parts else "untitled"


def parse_hatena_date(date_raw: str) -> Optional[datetime]:
    """DATE: 07/12/2026 02:59:29 AM 形式をパースする。"""
    date_raw = date_raw.strip()
    formats = [
        "%m/%d/%Y %I:%M:%S %p",
        "%m/%d/%Y %H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_raw, fmt)
        except ValueError:
            continue
    return None


def date_from_basename(basename: str) -> Optional[datetime]:
    parts = [p for p in basename.strip().split("/") if p]
    if len(parts) >= 4:
        y, mo, d, hms = parts[0], parts[1], parts[2], parts[3]
        try:
            if len(hms) == 6:
                h, mi, s = hms[0:2], hms[2:4], hms[4:6]
            else:
                h, mi, s = "00", "00", "00"
            return datetime(int(y), int(mo), int(d), int(h), int(mi), int(s))
        except ValueError:
            return None
    return None


def entry_sort_key(entry: HatenaEntry) -> datetime:
    dt = parse_hatena_date(entry.date_raw)
    if dt is None:
        dt = date_from_basename(entry.basename)
    if dt is None:
        dt = datetime.min
    return dt


# ---------------------------------------------------------------------------
# 本文変換
# ---------------------------------------------------------------------------

HTML_TAG_RE = re.compile(r"<[a-zA-Z/][^>]*>")


def looks_like_html(body: str) -> bool:
    """本文がHTMLタグ主体かどうかのヒューリスティック判定。

    はてな記法やMarkdownで書かれた本文にも `<img>` や `<a>` が
    部分的に混ざることがあるため、タグの出現数と本文長の比率で判定する。
    """
    if not body.strip():
        return False
    tags = HTML_TAG_RE.findall(body)
    if len(tags) < 2:
        return False
    # ブロックレベルタグが1つでもあればHTMLとみなす
    block_tag_re = re.compile(
        r"<(p|div|br|table|ul|ol|li|h[1-6]|blockquote|figure|iframe)\b", re.I
    )
    if block_tag_re.search(body):
        return True
    # ブロックタグは無いがインラインタグが多い場合もHTML扱い
    tag_chars = sum(len(t) for t in tags)
    return tag_chars / max(len(body), 1) > 0.1


def is_twitter_blockquote(tag: Tag) -> bool:
    if not isinstance(tag, Tag) or tag.name != "blockquote":
        return False
    classes = tag.get("class") or []
    return "twitter-tweet" in classes


def is_twitter_widget_script(node) -> bool:
    if not isinstance(node, Tag) or node.name != "script":
        return False
    src = node.get("src", "")
    return "platform.twitter.com/widgets.js" in src


def is_youtube_iframe(tag: Tag) -> bool:
    if not isinstance(tag, Tag) or tag.name != "iframe":
        return False
    src = tag.get("src", "") or ""
    return "youtube.com" in src or "youtu.be" in src


def is_hatena_blogcard(tag: Tag) -> bool:
    if not isinstance(tag, Tag):
        return False
    classes = tag.get("class") or []
    if tag.name == "iframe" and (
        "hatenablogcard" in classes or "embed-card" in classes
    ):
        return True
    if tag.name == "a" and "hatena-blogcard" in classes:
        return True
    return False


def find_blogcard_element(tag: Tag) -> Optional[Tag]:
    """ブログカード要素そのもの、またはそれを div 等でラップした構造から
    ブログカード本体(iframe/a)を探す。実データでは
    <div class="hatena-embed-..."><iframe class="embed-card" .../></div>
    のようにラップされているケースが多い。"""
    if not isinstance(tag, Tag):
        return None
    if is_hatena_blogcard(tag):
        return tag
    return tag.find(lambda t: is_hatena_blogcard(t))


def blogcard_to_markdown_link(tag: Tag) -> str:
    """はてなブログカードを通常のMarkdownリンクに変換する。"""
    href = None
    if tag.name == "a":
        href = tag.get("href")
    else:
        # iframe/div: 内部の<a>やdata属性からURLを探す
        href = tag.get("src") or tag.get("data-url")
        inner_a = tag.find("a")
        if not href and inner_a is not None:
            href = inner_a.get("href")

    title_text = tag.get_text(strip=True)
    if not title_text:
        title_text = tag.get("title", "") or ""
    if not href:
        href = ""
    if not title_text:
        title_text = href or "リンク"
    return "[{}]({})".format(title_text, href)


def resolve_img_src(img: Tag) -> Optional[str]:
    for attr in IMG_SRC_CANDIDATE_ATTRS:
        val = img.get(attr)
        if val and not val.startswith("data:"):
            return val
    # srcset から最初のURLを拾う
    srcset = img.get("srcset") or img.get("data-srcset")
    if srcset:
        first = srcset.split(",")[0].strip().split(" ")[0]
        if first:
            return first
    return None


def normalize_images(soup_fragment) -> None:
    """<img>のlazy-load属性・srcsetから実URLを拾い、srcへ正規化する。"""
    for img in soup_fragment.find_all("img"):
        real_src = resolve_img_src(img)
        if real_src:
            img["src"] = real_src


def convert_html_body(html: str) -> "tuple[str, List[str]]":
    """HTML本文をMarkdownへ変換する。特殊要素は温存/リンク化する。"""
    warnings: List[str] = []
    soup = BeautifulSoup(html, "html.parser")
    normalize_images(soup)

    output_blocks: List[str] = []
    nodes = list(soup.contents)
    i = 0
    n = len(nodes)

    while i < n:
        node = nodes[i]

        if isinstance(node, NavigableString):
            text = str(node)
            if text.strip():
                output_blocks.append(html_to_md(text).strip())
            i += 1
            continue

        if is_twitter_blockquote(node):
            block_html = str(node)
            # 直後のscriptタグ(widgets.js)も一緒に温存する
            j = i + 1
            while j < n and isinstance(nodes[j], NavigableString) and not str(nodes[j]).strip():
                j += 1
            if j < n and is_twitter_widget_script(nodes[j]):
                block_html += "\n" + str(nodes[j])
                i = j + 1
            else:
                i += 1
            output_blocks.append(block_html)
            continue

        if is_youtube_iframe(node):
            output_blocks.append(str(node))
            i += 1
            continue

        blogcard_el = find_blogcard_element(node) if isinstance(node, Tag) else None
        if blogcard_el is not None:
            output_blocks.append(blogcard_to_markdown_link(blogcard_el))
            i += 1
            continue

        if isinstance(node, Tag) and node.name == "table":
            warnings.append("table要素をHTMLのまま温存しました（要目視確認）")
            output_blocks.append(str(node))
            i += 1
            continue

        if isinstance(node, Tag) and node.name == "script":
            # 対応するblockquoteが見つからなかった孤立scriptはそのまま温存
            if is_twitter_widget_script(node):
                output_blocks.append(str(node))
            i += 1
            continue

        # 未知のclassを持つ要素は警告のみ出してmarkdownify変換は試みる
        if isinstance(node, Tag) and node.get("class"):
            classes = node.get("class")
            known_prefixes = ("hatena", "twitter", "embed")
            if not any(any(c.startswith(p) for p in known_prefixes) for c in classes):
                pass  # 一般的なclass(装飾目的など)は変換を試みるだけで十分

        md_fragment = html_to_md(str(node), heading_style="ATX").strip()
        if md_fragment:
            output_blocks.append(md_fragment)
        i += 1

    body_md = "\n\n".join(b for b in output_blocks if b.strip())
    return body_md, warnings


def convert_body(raw_body: str) -> "tuple[str, List[str]]":
    if looks_like_html(raw_body):
        return convert_html_body(raw_body)
    else:
        warning = (
            "本文がHTML主体と判定できませんでした"
            "（はてな記法/Markdownの可能性）。変換せずそのまま出力しています。"
            "手動確認してください。"
        )
        return raw_body.strip(), [warning]


# ---------------------------------------------------------------------------
# frontmatter / ファイル出力
# ---------------------------------------------------------------------------


def yaml_escape_dquoted(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def build_frontmatter(post: ConvertedPost) -> str:
    lines = ["---"]
    lines.append('title: "{}"'.format(yaml_escape_dquoted(post.title)))
    lines.append("date: {}".format(post.date_str))
    if post.categories:
        cats = ", ".join('"{}"'.format(yaml_escape_dquoted(c)) for c in post.categories)
        lines.append("categories: [{}]".format(cats))
    lines.append('hatena_url: "{}"'.format(yaml_escape_dquoted(post.hatena_url)))
    lines.append("---")
    return "\n".join(lines)


def build_markdown_file(post: ConvertedPost) -> str:
    fm = build_frontmatter(post)
    body = post.body_md.strip("\n")
    return fm + "\n\n" + body + "\n"


# ---------------------------------------------------------------------------
# メイン処理
# ---------------------------------------------------------------------------


def convert_entry(entry: HatenaEntry) -> ConvertedPost:
    slug = basename_to_slug(entry.basename)
    dt = parse_hatena_date(entry.date_raw) or date_from_basename(entry.basename)
    date_str = dt.strftime("%Y-%m-%d") if dt else ""
    hatena_url = HATENA_ENTRY_URL_BASE + entry.basename.strip()

    warnings: List[str] = []
    if not entry.title:
        warnings.append("TITLEが空です")
    if not date_str:
        warnings.append("DATEを解釈できませんでした。frontmatterのdateが空になります")
    if not entry.basename:
        warnings.append("BASENAMEが空です。slug/hatena_urlが不正な可能性があります")

    body_md, body_warnings = convert_body(entry.body)
    warnings.extend(body_warnings)

    return ConvertedPost(
        slug=slug,
        title=entry.title or slug,
        date_str=date_str,
        categories=entry.categories,
        hatena_url=hatena_url,
        body_md=body_md,
        warnings=warnings,
    )


def _force_utf8_console() -> None:
    """Windowsのコンソールが既定でcp932等の場合に文字化けするのを防ぐ。"""
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream is not None and hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


def main() -> int:
    _force_utf8_console()
    parser = argparse.ArgumentParser(
        description="はてなブログ(MT形式)エクスポートをAstroブログ記事へ変換する"
    )
    parser.add_argument("export_file", type=Path, help="MT形式エクスポートファイルのパス")
    parser.add_argument(
        "--limit", type=int, default=None, help="新しい順にN記事のみ変換する"
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("src/content/blog"),
        help="出力先ディレクトリ (デフォルト: src/content/blog)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="ファイルを書き込まず、変換結果の概要のみ表示する",
    )
    args = parser.parse_args()

    if not args.export_file.exists():
        print("エラー: エクスポートファイルが見つかりません: {}".format(args.export_file), file=sys.stderr)
        return 1

    text = read_export_file(args.export_file)
    entries = parse_mt_file(text)

    total_parsed = len(entries)
    skipped_draft = [e for e in entries if e.status.strip().lower() not in PUBLISH_STATUSES]
    publishable = [e for e in entries if e.status.strip().lower() in PUBLISH_STATUSES]

    publishable.sort(key=entry_sort_key, reverse=True)

    if args.limit is not None:
        target_entries = publishable[: args.limit]
    else:
        target_entries = publishable

    converted_posts: List[ConvertedPost] = []
    for entry in target_entries:
        converted_posts.append(convert_entry(entry))

    # slug重複チェック
    seen_slugs = {}
    for post in converted_posts:
        if post.slug in seen_slugs:
            post.warnings.append(
                "slugが重複しています ({}) — ファイルが上書きされます".format(post.slug)
            )
        seen_slugs[post.slug] = seen_slugs.get(post.slug, 0) + 1

    if not args.dry_run:
        args.out.mkdir(parents=True, exist_ok=True)

    for post in converted_posts:
        content = build_markdown_file(post)
        out_path = args.out / "{}.md".format(post.slug)
        if args.dry_run:
            print("[dry-run] 書き込み予定: {}".format(out_path))
        else:
            out_path.write_text(content, encoding="utf-8")
            print("書き込み: {}".format(out_path))

    # サマリ表示
    print("\n" + "=" * 60)
    print("変換サマリ")
    print("=" * 60)
    print("パースした記事数     : {}".format(total_parsed))
    print("下書き/非公開スキップ : {}".format(len(skipped_draft)))
    print("変換対象記事数        : {}".format(len(target_entries)))
    print("変換完了記事数        : {}".format(len(converted_posts)))
    if args.limit is not None:
        print("（--limit {} を適用）".format(args.limit))
    print("モード                : {}".format("dry-run（書き込みなし）" if args.dry_run else "書き込みあり"))

    print("\n記事一覧:")
    for post in converted_posts:
        warn_note = " [警告あり x{}]".format(len(post.warnings)) if post.warnings else ""
        print("  - {} | {} | {}{}".format(post.slug, post.date_str, post.title, warn_note))

    all_warnings = [(p.slug, w) for p in converted_posts for w in p.warnings]
    if all_warnings:
        print("\n警告一覧 ({}件):".format(len(all_warnings)))
        for slug, w in all_warnings:
            print("  - [{}] {}".format(slug, w))
    else:
        print("\n警告: なし")

    return 0


if __name__ == "__main__":
    sys.exit(main())
