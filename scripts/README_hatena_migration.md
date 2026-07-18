# はてなブログ → Astro 移行スクリプト

はてなブログのエクスポートファイル（Movable Type形式）を読み込み、
`src/content/blog/<slug>.md` 形式のAstroブログ記事に変換するCLIツールです。

## 事前準備

```bash
pip install markdownify beautifulsoup4
```

Python 3.9 以降で動作します（`from __future__ import annotations` を使用）。

## エクスポートファイルの取得方法

はてなブログ管理画面 →「設定」→「詳細設定」→「エクスポート」から
Movable Type形式でエクスポートしたテキストファイルを使用します。

## 使い方

```bash
# まずはdry-runで確認（ファイルは書き込まれない）
python scripts/migrate_hatena.py path/to/hatena-export.txt --dry-run

# 新しい順に5記事だけ試しに変換
python scripts/migrate_hatena.py path/to/hatena-export.txt --limit 5

# 出力先を明示（デフォルトは src/content/blog）
python scripts/migrate_hatena.py path/to/hatena-export.txt --out src/content/blog

# 全記事を変換
python scripts/migrate_hatena.py path/to/hatena-export.txt
```

### オプション

| オプション | 説明 |
| --- | --- |
| `export_file`（必須） | MT形式エクスポートファイルのパス |
| `--limit N` | 更新日時が新しい順にN記事のみ変換する（試行運用用。下書き/非公開は最初から除外した上でカウント） |
| `--out DIR` | 出力先ディレクトリ（デフォルト: `src/content/blog`） |
| `--dry-run` | ファイルを書き込まず、変換されるslug・タイトル・警告の概要のみ表示する |

`STATUS` が `Publish` 以外（`Draft` など）の記事は自動的にスキップされます。

## 変換ルール

- **slug / ファイル名**: `BASENAME`（例: `2026/07/12/025929`）から `2026-07-12-025929.md` を生成
- **frontmatter**:
  - `title`: `TITLE` フィールドそのまま
  - `date`: `DATE` フィールドから `YYYY-MM-DD` を算出
  - `categories`: `CATEGORY` フィールド（複数可）を配列化
  - `hatena_url`: `https://sin1n24.hatenablog.com/entry/<BASENAME>` を自動生成して付与
    （`src/content.config.ts` に optional フィールドとして追加済み）
- **本文変換**:
  - 本文がHTMLタグ主体と判定できた場合のみ `markdownify` + `BeautifulSoup` でMarkdown化
  - HTMLと判定できない場合（はてな記法・Markdownで書かれている可能性）は
    変換せずそのまま出力し、警告を出す（はてな記法の本格変換は今回のスコープ外）
  - **画像**: はてなフォトライフ等のURLは書き換えずそのまま `![alt](url)` 化する。
    lazy-load属性（`data-src` 等）や `srcset` から実URLを優先的に拾う
  - **Twitter/X埋め込み** (`blockquote.twitter-tweet` + `widgets.js`): HTMLのまま温存
  - **YouTube埋め込み** (`iframe`): HTMLのまま温存
  - **はてなブログカード** (`iframe.embed-card` / `a.hatena-blogcard` など、`div`でラップされている場合も検出): 通常のMarkdownリンク `[タイトル](URL)` に変換
  - **table・未知のclass等**: 変換に自信が持てない要素はHTMLのまま温存し、警告を出す

## テスト用フィクスチャ

`scripts/tests/fixture_hatena.mt` に、実データが届く前の動作確認用フィクスチャを用意しています。
上記の変換ルール（画像lazy-load、Twitter埋め込み、YouTube埋め込み、ブログカード、table、
はてな記法/Markdown本文、下書き記事のスキップ）を一通りカバーしています。

```bash
python scripts/migrate_hatena.py scripts/tests/fixture_hatena.mt --dry-run
python scripts/migrate_hatena.py scripts/tests/fixture_hatena.mt --out scripts/tests/expected
```

`scripts/tests/expected/` にはフィクスチャから生成した変換結果のサンプルを置いています
（`src/content/blog/` には置かないこと。実記事と混ざらないようにするため）。

## 実データが届いたら確認すべきこと

- `STATUS` の値が本当に `Publish`/`Draft` の2種類だけか（他の文字列がないか）
- `CATEGORY` の実際の書式（空白や全角文字の有無、階層カテゴリの有無）
- `BODY` の編集モードが記事ごとに異なっていないか
  （見たままモード=HTML、はてな記法、Markdownが混在していないか）。
  はてな記法の記事が多い場合は本格的な変換ロジックの追加を検討する
- 画像URLのドメイン・lazy-load属性名が `cdn-ak.f.st-hatena.com` /
  `data-src` の想定通りか（実際の属性名が異なる場合は
  `IMG_SRC_CANDIDATE_ATTRS` を調整する）
- ブログカードのHTML構造が実際にどうなっているか
  （`iframe.embed-card` か `a.hatena-blogcard` か、別の構造か）
- 絵文字・特殊文字を含むタイトルでYAMLの引用符エスケープが壊れないか
- `--limit 5` で試行運用した際に生成された記事を必ず目視確認してから
  本番の全件移行に進むこと
