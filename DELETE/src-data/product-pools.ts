// カテゴリ別のAmazon関連商品プール。記事のfrontmatterにrelatedProductsが
// 無い場合、ここからカテゴリに応じて重み付きランダムで自動選出する
// （新規記事投稿時に手動で商品を選ばなくても「関連商品」が表示される仕組み）。
// weightが高いほど「売れそう」な商品として優先的に選ばれやすくなる。
// ASINはsrc/data/amazon-products.ymlに実在すること。

type WeightedAsin = [asin: string, weight: number];

const KAWAROBO_POOL: WeightedAsin[] = [
  ["B0CP36Z828", 3], ["B00VUJYNWG", 3], ["B016FKJJ8M", 2], ["B081SSR8ST", 3],
  ["B01N1G0L2A", 2], ["B0H83WKJV9", 2], ["B0DKXKS9CQ", 2], ["B0DHXSVJC2", 2],
  ["B0H73745BV", 3], ["B0CY9FVXHF", 1], ["B085QK2T6V", 3], ["B0181UI52A", 1],
  ["B017BIX7CQ", 2], ["B07H673FGF", 2],
];

const GIJUTSU_POOL: WeightedAsin[] = [
  ["B01MXNYG27", 2], ["B00ZUA4TGQ", 1], ["B0D3C1VCPC", 2], ["B0C48N9W1B", 2],
  ["B07JP9XGH1", 2], ["B0188SBX8I", 1], ["B01ICQ4PAY", 1], ["B0C7KYYF5S", 3],
  ["B0GYDSWX7M", 2], ["B0DQPGWZVH", 2], ["B07R1QDVWF", 2], ["B085QK2T6V", 3],
  ["B0H7MHNN14", 2], ["B0015X804Y", 1],
];

const GADGET_POOL: WeightedAsin[] = [
  ["B0CXNY69DC", 3], ["B07QQR6G5N", 3], ["B0CJR8Y56J", 3], ["B0F8BV5Z31", 2],
  ["B0BCK3V2X6", 2], ["B0G1B7RZ28", 2], ["B0FQ57B4M4", 2], ["B0CF1DLZPY", 3],
  ["B0DRCR8KDX", 3], ["B0H2WJ5PTR", 2], ["B0CK1B1L9L", 2],
];

const GENERAL_POOL: WeightedAsin[] = [
  ["B0CK1B1L9L", 3], ["B0CXNY69DC", 3], ["B0BCK3V2X6", 2], ["B00NS9YDNK", 2],
  ["B0H2WJ5PTR", 2], ["B0FQ57B4M4", 1], ["B085QK2T6V", 2], ["B07QQR6G5N", 2],
  ["B0CJR8Y56J", 2], ["B0F8BV5Z31", 2], ["B0G1B7RZ28", 1],
];

const MINI_KAWAROBO_POOL: WeightedAsin[] = [
  ["B00VUJYNWG", 3], ["B016FKJJ8M", 2], ["B0CP36Z828", 3], ["B085QK2T6V", 3],
  ["B0CY9FVXHF", 2], ["B0C48N9W1B", 2], ["B0181UI52A", 1], ["B0D3C1VCPC", 1],
];

/** 記事のcategoriesから使用する商品プールを決定する */
function resolvePool(categories: string[] | undefined): WeightedAsin[] {
  const cats = new Set(categories ?? []);
  const has = (c: string) => cats.has(c);

  if (has("かわロボ") && has("ミニかわロボ") && has("技術")) {
    return [...KAWAROBO_POOL, ...MINI_KAWAROBO_POOL, ...GIJUTSU_POOL];
  }
  if (has("かわロボ") && has("技術")) {
    return [...KAWAROBO_POOL, ...GIJUTSU_POOL];
  }
  if (has("かわロボ")) return KAWAROBO_POOL;
  if (has("ミニかわロボ")) return MINI_KAWAROBO_POOL;
  if (has("技術")) return GIJUTSU_POOL;
  if (has("ガジェット")) return GADGET_POOL;
  return GENERAL_POOL;
}

/** 文字列から決定的な32bit整数シードを作る（FNV-1a） */
function seedFromString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** シード固定の擬似乱数生成器（mulberry32）。ビルドの度に結果が変わらないようにする */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Efraimidis-Spirakis法による重み付き非復元抽出 */
function weightedSampleNoReplace(pool: WeightedAsin[], k: number, rng: () => number, exclude: Set<string> = new Set()): string[] {
  const seen = new Set<string>();
  const keyed: Array<[number, string]> = [];
  for (const [asin, weight] of pool) {
    if (seen.has(asin) || exclude.has(asin)) continue;
    seen.add(asin);
    const u = rng();
    const key = Math.pow(u, 1 / weight);
    keyed.push([key, asin]);
  }
  keyed.sort((a, b) => b[0] - a[0]);
  return keyed.slice(0, k).map(([, asin]) => asin);
}

/**
 * 記事に紐づく関連商品ASINを決める。frontmatterにrelatedProductsが明示されて
 * いればそれを優先し（不足分のみカテゴリプールで5件まで補完）、無指定なら
 * カテゴリプールから丸ごと自動選出する。post.idをシードに使うため、同じ記事は
 * 常に同じ組み合わせになる（ビルドごとに表示がぶれない）。
 */
export function resolveRelatedProducts(postId: string, categories: string[] | undefined, explicit: string[] | undefined, limit = 5): string[] {
  const pool = resolvePool(categories);
  const rng = mulberry32(seedFromString(postId));
  const base = (explicit ?? []).slice(0, limit);
  if (base.length >= limit) return base;
  const extra = weightedSampleNoReplace(pool, limit - base.length, rng, new Set(base));
  return [...base, ...extra];
}
