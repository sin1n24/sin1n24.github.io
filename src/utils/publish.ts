// 記事の公開可否判定（下書き / 予定日公開の共通ロジック）。
// getCollection('blog') を呼ぶ箇所（トップページ・ブログ一覧・カテゴリページ・[slug].astro）
// では必ずここを通してからマッピング・件数集計を行うこと。
// [slug].astro側でフィルタすればページ自体がビルドされず直URLでも到達不能になり、
// sitemap（@astrojs/sitemap は実際に生成されたページを拾う）・Pagefind（dist/を索引）も
// 自動的に除外されるため、そちら側の個別対応は不要。

interface PublishableData {
  date: Date;
  draft?: boolean;
}

/**
 * JSTの「今日」の日付文字列（YYYY-MM-DD）を返す。
 * ビルドはGitHub Actions上のUTCで走るため、+9時間シフトしてから日付部分を取る。
 */
function todayJST(now: Date): string {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

export function isPublished(data: PublishableData, now: Date = new Date()): boolean {
  if (data.draft) return false;
  // date は `z.coerce.date()` で "YYYY-MM-DD" をUTC 0時としてパースしたものなので、
  // toISOString()の日付部分がfrontmatterに書いた日付とそのまま一致する。
  const postDay = data.date.toISOString().slice(0, 10);
  return postDay <= todayJST(now);
}
