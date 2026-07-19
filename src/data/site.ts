// サイト全体の定数（SNSリンク・GA ID・見積りフォーム定数）
// 見積りフォームは将来 Google Forms / GAS フォームへ差し替える可能性があるため、
// URLをここ1箇所にまとめる。QUOTE_FORM_URL が null の間は mailto にフォールバックする。

export const SITE = {
  title: "sin1's studio",
  description: "ロボットつくるよ",
  url: "https://sin1.studio",
  lang: "ja",
  author: "sin1",
  email: "sin1@sin1.studio",
  copyright: "© 2026 sin1. All rights reserved.",
} as const;

export const GA_MEASUREMENT_ID = "G-S8GDP6VQHY";

export interface SocialLink {
  name: string;
  url: string;
  icon: "x" | "github" | "youtube" | "makerworld" | "blog" | "email";
}

export const SOCIAL_LINKS: SocialLink[] = [
  { name: "X", url: "https://x.com/sin1west", icon: "x" },
  { name: "GitHub", url: "https://github.com/sin1n24", icon: "github" },
  { name: "YouTube", url: "https://www.youtube.com/@sin1n24", icon: "youtube" },
  { name: "MakerWorld", url: "https://makerworld.com/en/@sin1west", icon: "makerworld" },
  { name: "Blog", url: "/blog/", icon: "blog" },
  { name: "Email", url: "mailto:sin1@sin1.studio", icon: "email" },
];

// 将来 Google Forms / GAS フォームのURLに差し替える定数。
// null の間は buildQuoteMailto() による mailto リンクを使う。
export const QUOTE_FORM_URL: string | null = null;

/** 大量購入見積り依頼用のmailtoリンクを生成する（数量・納期などのテンプレ本文入り） */
export function buildQuoteMailto(productTitle: string): string {
  const subject = `【大量購入見積り依頼】${productTitle}`;
  const body =
    `${productTitle} の大量購入について見積りを依頼します。\n\n` +
    `ご希望数量：\n` +
    `希望納期：\n` +
    `お届け先：\n` +
    `その他ご要望：\n`;
  return `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
