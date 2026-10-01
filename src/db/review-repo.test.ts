import { afterEach, describe, expect, it } from "vitest";
import { makePost } from "../test/factories";
import { openTestDb } from "../test/db";
import { completeReview, ensureTodayReview, remainingReviewCount } from "./review-repo";
import { updateSettings } from "./settings";

const db = openTestDb();
afterEach(async () => {
  await Promise.all([db.posts.clear(), db.kv.clear()]);
});

async function seed(n: number) {
  await db.posts.bulkPut(Array.from({ length: n }, (_, i) => makePost({ id: String(i + 1) })));
}

describe("ensureTodayReview", () => {
  it("その日の顔ぶれを作って保存し、同じ日はそれを返す", async () => {
    await seed(10);
    await updateSettings(db, { reviewPerDay: 3 });
    const first = await ensureTodayReview(db, "2026-10-02");
    expect(first.postIds).toHaveLength(3);
    await db.posts.put(makePost({ id: "999" }));
    expect(await ensureTodayReview(db, "2026-10-02")).toEqual(first);
  });
  it("日付が変わったら選び直す", async () => {
    await seed(10);
    const a = await ensureTodayReview(db, "2026-10-02");
    const b = await ensureTodayReview(db, "2026-10-03");
    expect(b.date).toBe("2026-10-03");
    expect(b.doneIds).toEqual([]);
    expect(a.date).toBe("2026-10-02");
  });
});

describe("completeReview", () => {
  it("済みにして見返しを記録し、残り件数が減る", async () => {
    await seed(5);
    await updateSettings(db, { reviewPerDay: 2 });
    const t = await ensureTodayReview(db, "2026-10-02");
    const target = t.postIds[0] as string;
    expect(await remainingReviewCount(db, "2026-10-02")).toBe(2);
    await completeReview(db, target, "2026-10-02", "2026-10-02T09:00:00.000Z");
    expect(await remainingReviewCount(db, "2026-10-02")).toBe(1);
    expect((await db.posts.get(target))?.review).toEqual({ count: 1, lastAt: "2026-10-02T09:00:00.000Z" });
  });
  it("同じ投稿を 2 回済みにしても 1 回だけ数える。今日の顔ぶれ以外は無視", async () => {
    await seed(5);
    const t = await ensureTodayReview(db, "2026-10-02");
    const target = t.postIds[0] as string;
    await completeReview(db, target, "2026-10-02", "2026-10-02T09:00:00.000Z");
    await completeReview(db, target, "2026-10-02", "2026-10-02T09:05:00.000Z");
    const after = await completeReview(db, "not-today", "2026-10-02", "2026-10-02T09:10:00.000Z");
    expect(after.doneIds).toEqual([target]);
    expect((await db.posts.get(target))?.review.count).toBe(1);
  });
});
