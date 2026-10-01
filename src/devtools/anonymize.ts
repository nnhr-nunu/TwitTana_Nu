/** 値を残すキー（データの構造を表すだけで、個人の情報を含まないもの） */
const KEEP_KEYS = new Set(["__typename", "type", "entryType", "itemType", "cursorType", "content_type", "displayType", "tweetDisplayType", "role"]);
const NUMERIC = /^\d{4,}$/;
const BASE_ID = 1900000000000000000n;

function compareNumeric(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

function collectNumbers(node: unknown, key: string, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const v of node) collectNumbers(v, key, out);
  } else if (typeof node === "object" && node !== null) {
    for (const [k, v] of Object.entries(node)) collectNumbers(v, k, out);
  } else if (typeof node === "string" && !KEEP_KEYS.has(key) && NUMERIC.test(node)) {
    out.add(node);
  }
}

/**
 * X の返事 JSON から個人の情報を取り除く（テスト用データにするため）。
 * - 4 桁以上の数字の文字列は、大小関係を保った架空の数字に
 * - URL は https://example.com/N に、それ以外の文字列は text-N に（同じ文字列は同じ置き換え）
 * - 構造を表すキーの値・数値・真偽値・null はそのまま
 */
export function anonymize(input: unknown): unknown {
  const numbers = new Set<string>();
  collectNumbers(input, "", numbers);
  const numberMap = new Map([...numbers].sort(compareNumeric).map((n, i) => [n, String(BASE_ID + BigInt(i) * 1000n)]));
  const stringMap = new Map<string, string>();

  const replaceString = (s: string): string => {
    const mapped = numberMap.get(s);
    if (mapped) return mapped;
    let replaced = stringMap.get(s);
    if (!replaced) {
      const n = stringMap.size + 1;
      replaced = /^https?:\/\//.test(s) ? `https://example.com/${n}` : `text-${n}`;
      stringMap.set(s, replaced);
    }
    return replaced;
  };

  const walk = (node: unknown, key: string): unknown => {
    if (Array.isArray(node)) return node.map((v) => walk(v, key));
    if (typeof node === "object" && node !== null) {
      return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v, k)]));
    }
    if (typeof node === "string" && !KEEP_KEYS.has(key)) {
      // 本文中の URL も置き換える（短縮 URL と本文の対応を保つ）
      if (!numberMap.has(node) && /\shttps?:\/\//.test(node)) {
        return node
          .split(/(\s+)/)
          .map((part) => (/^https?:\/\//.test(part) ? replaceString(part) : /^\s+$/.test(part) ? part : replaceString(part)))
          .join("");
      }
      return replaceString(node);
    }
    return node;
  };

  return walk(input, "");
}
