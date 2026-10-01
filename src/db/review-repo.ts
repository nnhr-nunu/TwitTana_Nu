import { pickTodayReview, remainingReviewIds } from "../core/review";
import type { TodayReview } from "../core/types";
import { markReviewed } from "./posts";
import type { TwitTanaDB } from "./schema";
import { getSettings, updateSettings } from "./settings";

/** 今日の顔ぶれを返す。まだ無いか日付が変わっていれば選び直して保存する */
export async function ensureTodayReview(db: TwitTanaDB, today: string): Promise<TodayReview> {
  return db.transaction("rw", [db.posts, db.kv], async () => {
    const settings = await getSettings(db);
    if (settings.todayReview?.date === today) return settings.todayReview;
    const posts = await db.posts.toArray();
    const next: TodayReview = { date: today, postIds: pickTodayReview(posts, settings.reviewPerDay, today), doneIds: [] };
    await updateSettings(db, { todayReview: next });
    return next;
  });
}

/** 今日の 1 件を済みにする（見た・フォルダへ入れた・もう出さない のどれでも呼ぶ） */
export async function completeReview(db: TwitTanaDB, postId: string, today: string, now: string): Promise<TodayReview> {
  return db.transaction("rw", [db.posts, db.kv], async () => {
    const current = await ensureTodayReview(db, today);
    if (!current.postIds.includes(postId) || current.doneIds.includes(postId)) return current;
    await markReviewed(db, postId, now);
    const next: TodayReview = { ...current, doneIds: [...current.doneIds, postId] };
    await updateSettings(db, { todayReview: next });
    return next;
  });
}

/** 今日の残り件数（非表示にした投稿・消えた投稿は数えない） */
export async function remainingReviewCount(db: TwitTanaDB, today: string): Promise<number> {
  const ids = remainingReviewIds(await ensureTodayReview(db, today));
  const posts = await db.posts.bulkGet(ids);
  return posts.filter((p) => p !== undefined && !p.hidden).length;
}
