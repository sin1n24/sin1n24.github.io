export function extractDescription(markdown: string, length = 100): string {
  const plain = markdown
    .replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.slice(0, length);
}

export function extractFirstImage(markdown: string): string | null {
  const match = markdown.match(/!\[[^\]]*\]\(([^)\s]+)/);
  return match ? match[1] : null;
}
