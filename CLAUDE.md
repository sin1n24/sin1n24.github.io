# CLAUDE.md

sin1's studio (https://sin1.studio) のソースリポジトリ。Astro製の静的サイト。
ブログ記事は `src/content/blog/*.md`、商品マスタは `src/data/amazon-products.yml`。

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
