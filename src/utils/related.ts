import type { CollectionEntry } from 'astro:content';

type BlogPost = CollectionEntry<'blog'>;

// 同じカテゴリを持つ記事を新しい順に返す（記事詳細ページの「関連記事」用）
export function relatedPosts(post: BlogPost, allPosts: BlogPost[], limit = 3): BlogPost[] {
  const categories = post.data.categories ?? [];
  if (!categories.length) return [];
  return allPosts
    .filter((p) => p.id !== post.id && (p.data.categories ?? []).some((c) => categories.includes(c)))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .slice(0, limit);
}

/**
 * 「注目記事」の疑似スコアリング（アクセス解析を持たない静的サイトのための代替指標）。
 * 実際のPVではなく、(a) 他記事の関連記事欄に採用された回数（＝活発なカテゴリの
 * 新しめの記事ほど高スコア）と (b) 記事が属するカテゴリの記事数を見て自動選出する。
 * 直近90日以内の記事を優先し、該当がlimit未満なら全期間から補う。
 */
export function featuredPosts(allPosts: BlogPost[], now: Date = new Date(), limit = 3): BlogPost[] {
  const inDegree = new Map<string, number>();
  allPosts.forEach((post) => {
    relatedPosts(post, allPosts).forEach((r) => {
      inDegree.set(r.id, (inDegree.get(r.id) ?? 0) + 1);
    });
  });

  const categorySize = new Map<string, number>();
  allPosts.forEach((post) => {
    (post.data.categories ?? []).forEach((c) => {
      categorySize.set(c, (categorySize.get(c) ?? 0) + 1);
    });
  });
  const maxCategorySize = (post: BlogPost) => {
    const categories = post.data.categories ?? [];
    if (!categories.length) return 0;
    return Math.max(...categories.map((c) => categorySize.get(c) ?? 0));
  };

  const windowMs = 90 * 24 * 60 * 60 * 1000;
  const recent = allPosts.filter((p) => now.getTime() - p.data.date.valueOf() <= windowMs);
  const pool = recent.length >= limit ? recent : allPosts;

  return [...pool]
    .sort((a, b) => {
      const scoreA = (inDegree.get(a.id) ?? 0) * 3 + maxCategorySize(a);
      const scoreB = (inDegree.get(b.id) ?? 0) * 3 + maxCategorySize(b);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.data.date.valueOf() - a.data.date.valueOf();
    })
    .slice(0, limit);
}
