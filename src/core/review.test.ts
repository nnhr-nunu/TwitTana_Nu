import { describe, expect, it } from "vitest";
import { makePost } from "../test/factories";
import { localDateString, pickTodayReview, remainingReviewIds, seededShuffle } from "./review";

function many(n: number) {
  return Array.from({ length: n }, (_, i) => makePost({ id: String(i + 1), bookmarkOrder: String(1000 + i) }));
}

describe("seededShuffle", () => {
  it("同じ種なら同じ並び、違う種なら（たいてい）違う並び", () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    expect(seededShuffle(items, "2026-10-02")).toEqual(seededShuffle(items, "2026-10-02"));
    expect(seededShuffle(items, "2026-10-02")).not.toEqual(seededShuffle(items, "2026-10-03"));
  });
  it("元の配列を変えない", () => {
    const items = [1, 2, 3];
    seededShuffle(items, "x");
    expect(items).toEqual([1, 2, 3]);
  });
});

describe("pickTodayReview", () => {
  it("同じ日なら同じ顔ぶれ", () => {
    const posts = many(80);
    expect(pickTodayReview(posts, 5, "2026-10-02")).toEqual(pickTodayReview(posts, 5, "2026-10-02"));
  });
  it("見返していない投稿のうち、古い 50 件の中から選ぶ", () => {
    const picked = pickTodayReview(many(80), 5, "2026-10-02");
    expect(picked).toHaveLength(5);
    for (const id of picked) expect(Number(id)).toBeLessThanOrEqual(50);
  });
  it("非表示は選ばない", () => {
    const posts = [makePost({ id: "1", hidden: true }), makePost({ id: "2" })];
    expect(pickTodayReview(posts, 5, "2026-10-02")).toEqual(["2"]);
  });
  it("足りなければ、見返したのが前のものから足す", () => {
    const posts = [
      makePost({ id: "1" }),
      makePost({ id: "2", review: { count: 1, lastAt: "2026-09-10T00:00:00.000Z" } }),
      makePost({ id: "3", review: { count: 4, lastAt: "2026-08-01T00:00:00.000Z" } }),
    ];
    expect(pickTodayReview(posts, 3, "2026-10-02")).toEqual(["1", "3", "2"]);
  });
  it("0 件指定なら空", () => {
    expect(pickTodayReview(many(3), 0, "2026-10-02")).toEqual([]);
  });
});

describe("remainingReviewIds", () => {
  it("済みを除いた残り", () => {
    expect(remainingReviewIds({ date: "d", postIds: ["1", "2", "3"], doneIds: ["2"] })).toEqual(["1", "3"]);
    expect(remainingReviewIds(undefined)).toEqual([]);
  });
});

describe("localDateString", () => {
  it("その環境の日付で YYYY-MM-DD", () => {
    expect(localDateString(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});
