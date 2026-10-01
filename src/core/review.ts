import { compareByBookmark, compareNumericStrings } from "./order";
import type { Post, TodayReview } from "./types";

export const REVIEW_POOL_SIZE = 50;

function hashString(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** 種から決まる乱数（mulberry32） */
function seededRandom(seed: string): () => number {
  let a = hashString(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 種から決まる並べ替え（元の配列は変えない） */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const arr = [...items];
  const rnd = seededRandom(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}

/** 今日見返す投稿の ID を選ぶ。同じ日付なら同じ結果 */
export function pickTodayReview(posts: Post[], count: number, date: string): string[] {
  if (count <= 0) return [];
  const visible = posts.filter((p) => !p.hidden);
  const pool = visible
    .filter((p) => p.review.count === 0)
    .sort(compareByBookmark)
    .slice(0, REVIEW_POOL_SIZE);
  const picked = seededShuffle(pool, date)
    .slice(0, count)
    .map((p) => p.id);
  if (picked.length < count) {
    const reviewed = visible
      .filter((p) => p.review.count > 0)
      .sort((a, b) => (a.review.lastAt ?? "").localeCompare(b.review.lastAt ?? "") || compareNumericStrings(a.id, b.id));
    for (const p of reviewed) {
      if (picked.length >= count) break;
      picked.push(p.id);
    }
  }
  return picked;
}

export function remainingReviewIds(t: TodayReview | undefined): string[] {
  return t ? t.postIds.filter((id) => !t.doneIds.includes(id)) : [];
}

/** その環境のタイムゾーンでの日付 YYYY-MM-DD */
export function localDateString(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
