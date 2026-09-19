# CLAUDE.md

sin1's studio (https://sin1.studio) のソースリポジトリ。Astro製の静的サイト。
ブログ記事は `src/content/blog/*.md`、商品マスタは `src/data/amazon-products.yml`。

**呼称について**: ユーザーはこのサイト・プロジェクトを「SSS」「sss」
「sin1's studio」「sin1studio」などと略して呼ぶことがある。いずれも本リポジトリ・
本サイトを指す（別プロジェクトと混同しないこと）。

## ブログ記事を新規に書くとき（文体）

**新規記事の文体は同人誌『AI相棒とつくる（仮）』の執筆スタイルガイド
（`G:\マイドライブ\開発\同人誌\Book1\執筆スタイル.md`）の「文体 — 手本は著者本人の
ブログ」節を踏襲すること**。あちらは著者本人のはてなブログ
(https://sin1n24.hatenablog.com/) を分析して抽出した文体ルールで、SSSブログ本体
にもそのまま当てはまる。要点をここにも複製しておく（詳細・更新は上記ファイルが
正、ズレていたらそちらを読み直す）:

- です・ます調ベース。箇条書きや技術説明では体言止め・簡潔文を混ぜてリズムを出す。
- 書き出しは明るく「！」を1つ使ってよい（例:「〜を作りました！」）。多用はしない。
- 括弧の補足を活用する（例:「（運用は各自で）」）。
- 失敗談は淡々と短く書き、最後に軽くオチを付ける。深刻ぶらない。
- 提案・考察は断定せず「〜が良さそう」「〜そう」の柔らかい推量で締めることが多い。
- 実感ベースの感想を素直に書く。
- 一人称は「私」。
- 専門用語は初出時に括弧で1行説明。2回目以降は説明なし。
- 煽り・誇張をしない（「爆速」「神」等は使わない）。実測値があれば数字で語る。
- 補助動詞は漢字表記（「いただく」ではなく「頂く」、「いたします」ではなく「致します」）。

書く前に、既存記事を1〜2本（できれば直近のもの）読んで口調を掴んでから書き始めること。

## ブログ記事を新規投稿する/公開する作業をしたとき

**記事の執筆・投稿を頼まれたら、指示されなくても必ず以下を行うこと**
（ユーザーの方針: 関連商品はカテゴリベースの機械的ランダム選出に頼らず、
記事ごとに内容を読んで選ぶ。ランダムは使わない）。

### 1. カテゴリを設定する
frontmatterに `categories` を付ける。既存カテゴリ: `かわロボ` / `技術` /
`ミニかわロボ` / `ガジェット` / `お知らせ`。近いものが無ければ無理に既存カテゴリへ
押し込めず空でもよいが、空にすると「関連記事」欄には他のカテゴリ未設定記事
（日付が近い順）が表示される（`src/utils/related.ts` 参照）。

### 2. 「関連商品」を選んでfrontmatterに書く
記事の内容を実際に読んで、読者が買いそうなAmazon商品を**最大5件**選び、
`relatedProducts: ["ASIN1", "ASIN2", ...]` として設定する。

- まず `src/data/amazon-products.yml` に近い商品が既にあれば再利用する。
- 無ければAmazon商品ページをブラウザで開いて実在の商品を確認し、
  `amazon-products.yml` に追記する。手順:
  1. `https://www.amazon.co.jp/s?k=<検索語>` で検索し、
     `div[data-component-type="s-search-result"][data-asin]` から
     オーガニック結果のASINを取得する（広告枠を拾わないためこのセレクタを使う）。
  2. `https://www.amazon.co.jp/dp/<ASIN>` を開き、`#landingImage` または
     `#imgTagWrapperId img` の `src` から画像URLを取得する。
     `https://m.media-amazon.com/images/W/.../images/I/xxx.jpg` の形で
     取れることがあるが、`/images/W/.../` の部分を除いた
     `https://m.media-amazon.com/images/I/xxx.jpg` に正規化して使う。
  3. `<title>` からタイトルを取り、`amazon-products.yml` に追記する
     （ASINキーは必ずダブルクォートで囲む。数字だけのASIN／ISBNをクォート
     無しで書くとYAMLに整数として解釈され、参照できなくなるバグを過去に
     踏んだため）。
- アフィリエイトURLは `https://www.amazon.co.jp/dp/{ASIN}/?tag=sin1n24-22`
  の形で統一する。
- 商品が本当に見当たらない記事（内容が薄い日記等）でも、内容から連想できる
  ものをこじつけで構わないので1件は入れる（ユーザー許可済み）。ただし
  機械的なカテゴリ→固定商品の割り当てはしないこと。
- **relatedProducts未指定の記事は「関連商品」セクション自体が非表示になる**
  仕組みなので（`src/components/RelatedProducts.astro`、自動補完は一切しない）、
  設定を忘れると単にセクションが出ないだけで気づきにくい。必ず設定すること。
- **`DELETE/src-data/product-pools.ts` は復活させないこと**。既存224記事を
  一括で穴埋めした際に使った「カテゴリ→固定プールから重み付きランダム選出」の
  ロジックで、ユーザーの明示的な指示で撤去済み（同一商品セットの大量重複を招く
  ため）。新規記事には使わない。

### 3. 本文中にAmazon商品への言及があればlink-card化する
本文にAmazon商品URLやテキストリンクがあれば、以下のHTML形式のカードに
差し替える（生のMarkdownリンクのまま残さない）:

```html
<a class="link-card" href="https://www.amazon.co.jp/dp/{ASIN}/?tag=sin1n24-22" target="_blank" rel="noopener noreferrer sponsored"><img class="link-card-image" src="{画像URL}" alt="" loading="lazy" /><span class="link-card-body"><span class="link-card-title">{商品タイトル}</span><span class="link-card-domain">amazon.co.jp</span></span></a>
```

### 4. コミット・push
`sin1n24.github.io` リポジトリの変更は確認なしでpushしてよい
（2026-09-06付けユーザー指示）。push後はGitHub Actions
(`Deploy Astro site to Pages`) の成功を確認する。ローカルの `astro build` は
このマシン(Google Driveのストリーミングマウント配下)では
Node.jsのESMローダーが `\\?\` extended-length path を正しく扱えず失敗するため、
検証は基本的にCIビルド結果と本番サイトの実機確認で行うこと。

## 商品カードのCSS/デザインについて
- `.link-card`（本文用、横長1件）、`.product-card`（関連商品グリッド用、
  正方形寄り）は `src/styles/global.css` に定義済み。新規に作らず流用する。
- `.related-products-grid` は `auto-fill` + `minmax(160px, 1fr)` で、
  カード枚数が少なくても画像サイズが変わらないようにしてある
  (`max-width: 864px` で5列を安定して収める設計)。
