/** 比較用に文字をそろえる（全角半角・大文字小文字の違いをなくす） */
export function normalizeText(s: string): string {
  return s.normalize("NFKC").toLowerCase();
}

/** 入力されたドメインや URL を「example.com」の形にそろえる */
export function normalizeDomain(s: string): string {
  return normalizeText(s.trim())
    .replace(/^https?:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/^www\./, "");
}

/** URL のドメインを取り出す。URL でなければ空文字 */
export function domainOf(url: string): string {
  try {
    return normalizeDomain(new URL(url).hostname);
  } catch {
    return "";
  }
}
