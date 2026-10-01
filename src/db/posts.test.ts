import { afterEach, describe, expect, it } from "vitest";
import { makeCaptured, makePost } from "../test/factories";
import { openTestDb } from "../test/db";
import { addToFolder, markRemovedOnX, markReviewed, removeFromFolder, saveCaptured, setHidden } from "./posts";

const NOW = "2026-10-02T00:00:00.000Z";
const db = openTestDb();
afterEach(async () => {
  await Promise.all([db.posts.clear(), db.rules.clear()]);
});

describe("saveCaptured", () => {
  it("新しい投稿を保存し、ルールを当てる", async () => {
    await db.rules.put({ id: "r", folderId: "f", conditions: [{ kind: "keyword", value: "unity" }], enabled: true, order: 0 });
    const [p] = await saveCaptured(db, [makeCaptured({ id: "1", text: "Unity 講座" })], { now: NOW, bookmarked: true });
    expect(p?.folders).toEqual([{ folderId: "f", by: "rule" }]);
    expect(await db.posts.get("1")).toEqual(p);
  });
  it("既にある投稿の整理の状態を消さない", async () => {
    await db.posts.put(makePost({ id: "1", text: "古い", folders: [{ folderId: "a", by: "manual" }], sortedByUser: true, hidden: true, review: { count: 3 } }));
    await saveCaptured(db, [makeCaptured({ id: "1", text: "新しい" })], { now: NOW, bookmarked: true });
    expect(await db.posts.get("1")).toMatchObject({ text: "新しい", folders: [{ folderId: "a", by: "manual" }], sortedByUser: true, hidden: true, review: { count: 3 } });
  });
  it("1 回の保存に同じ投稿が 2 回あっても、中身のある方を残す", async () => {
    await saveCaptured(db, [makeCaptured({ id: "1", text: "本文" }), makeCaptured({ id: "1", text: "", partial: true })], { now: NOW, bookmarked: true });
    expect((await db.posts.get("1"))?.text).toBe("本文");
  });
  it("空なら何もしない", async () => {
    expect(await saveCaptured(db, [], { now: NOW, bookmarked: true })).toEqual([]);
  });
});

describe("フォルダの出し入れ", () => {
  it("手で入れると by: manual になり、手で整理した印が立つ", async () => {
    await db.posts.put(makePost({ id: "1", folders: [{ folderId: "a", by: "rule" }] }));
    await addToFolder(db, ["1"], "a");
    await addToFolder(db, ["1"], "b");
    expect(await db.posts.get("1")).toMatchObject({
      folders: [{ folderId: "a", by: "manual" }, { folderId: "b", by: "manual" }],
      sortedByUser: true,
    });
  });
  it("手で外しても手で整理した印が立つ", async () => {
    await db.posts.put(makePost({ id: "1", folders: [{ folderId: "a", by: "rule" }] }));
    await removeFromFolder(db, ["1"], "a");
    expect(await db.posts.get("1")).toMatchObject({ folders: [], sortedByUser: true });
  });
});

describe("そのほかの印", () => {
  it("解除済み・非表示・見返しの記録", async () => {
    await db.posts.put(makePost({ id: "1" }));
    await markRemovedOnX(db, "1");
    await setHidden(db, ["1"], true);
    await markReviewed(db, "1", NOW);
    await markReviewed(db, "1", NOW);
    expect(await db.posts.get("1")).toMatchObject({ removedOnX: true, hidden: true, review: { count: 2, lastAt: NOW } });
  });
  it("無い投稿への操作はエラーにしない", async () => {
    await expect(markRemovedOnX(db, "nothing")).resolves.toBeUndefined();
  });
});
