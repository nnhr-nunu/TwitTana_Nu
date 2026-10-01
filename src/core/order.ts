import type { Post } from "./types";

/** 数字だけの文字列を、桁数が違っても数として比べる */
export function compareNumericStrings(a: string, b: string): number {
  const x = a.replace(/^0+(?=\d)/, "");
  const y = b.replace(/^0+(?=\d)/, "");
  if (x.length !== y.length) return x.length - y.length;
  return x < y ? -1 : x > y ? 1 : 0;
}

/** ブクマした順（古い順）。並び値が両方にあればそれで、無ければ取り込んだ日時で比べる */
export function compareByBookmark(a: Post, b: Post): number {
  if (a.bookmarkOrder && b.bookmarkOrder) {
    const c = compareNumericStrings(a.bookmarkOrder, b.bookmarkOrder);
    if (c !== 0) return c;
  } else if (a.capturedAt !== b.capturedAt) {
    return a.capturedAt < b.capturedAt ? -1 : 1;
  }
  return compareNumericStrings(a.id, b.id);
}

/** 投稿日の古い順 */
export function compareByPosted(a: Post, b: Post): number {
  if (a.postedAt !== b.postedAt) return a.postedAt < b.postedAt ? -1 : 1;
  return compareNumericStrings(a.id, b.id);
}
