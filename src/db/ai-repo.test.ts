import { afterEach, describe, expect, it } from "vitest";
import { makePost } from "../test/factories";
import { openTestDb } from "../test/db";
import { aiCandidates, aiFolders, countAiCandidates, recordAiResult } from "./ai-repo";

const db = openTestDb();
afterEach(async () => {
  await Promise.all([db.posts.clear(), db.folders.clear()]);
});

describe("aiCandidates", () => {
  it("未整理・手で整理していない・非表示でない・中身あり・この版で未判定のものを、新しいブクマ順に", async () => {
    await db.posts.bulkPut([
      makePost({ id: "1", bookmarkOrder: "10" }),
      makePost({ id: "2", bookmarkOrder: "30" }),
      makePost({ id: "3", bookmarkOrder: "20", aiCheckedFoldersVersion: 7 }),
      makePost({ id: "4", bookmarkOrder: "40", aiCheckedFoldersVersion: 6 }),
      makePost({ id: "5", sortedByUser: true }),
      makePost({ id: "6", hidden: true }),
      makePost({ id: "7", partial: true }),
      makePost({ id: "8", folders: [{ folderId: "a", by: "rule" }] }),
    ]);
    expect((await aiCandidates(db, 7)).map((p) => p.id)).toEqual(["4", "2", "1"]);
    expect((await aiCandidates(db, 7, 1)).map((p) => p.id)).toEqual(["4"]);
    expect(await countAiCandidates(db, 7)).toBe(3);
  });
});

describe("aiFolders", () => {
  it("フォルダの並び順で、手で入れた投稿の本文を例として 2 件まで添える", async () => {
    await db.folders.bulkPut([
      { id: "b", name: "B", description: "説明B", order: 1, createdAt: "" },
      { id: "a", name: "A", description: "", order: 0, createdAt: "" },
    ]);
    await db.posts.bulkPut([
      makePost({ id: "1", text: "例1", folders: [{ folderId: "a", by: "manual" }] }),
      makePost({ id: "2", text: "例2", folders: [{ folderId: "a", by: "manual" }] }),
      makePost({ id: "3", text: "例3", folders: [{ folderId: "a", by: "manual" }] }),
      makePost({ id: "4", text: "AI のもの", folders: [{ folderId: "b", by: "ai" }] }),
    ]);
    const result = await aiFolders(db);
    expect(result.map((f) => [f.id, f.description, f.examples.length])).toEqual([
      ["a", "", 2],
      ["b", "説明B", 0],
    ]);
  });
});

describe("recordAiResult", () => {
  it("まだ未整理なら AI として入れ、判定済みの版を記録する", async () => {
    await db.folders.put({ id: "a", name: "A", description: "", order: 0, createdAt: "" });
    await db.posts.put(makePost({ id: "1" }));
    expect(await recordAiResult(db, "1", "a", 3)).toBe(true);
    expect(await db.posts.get("1")).toMatchObject({ folders: [{ folderId: "a", by: "ai" }], aiCheckedFoldersVersion: 3 });
  });

  it("処理中に手で整理された投稿や、消えたフォルダには入れない（判定済みの版は記録する）", async () => {
    await db.folders.put({ id: "a", name: "A", description: "", order: 0, createdAt: "" });
    await db.posts.bulkPut([makePost({ id: "1", sortedByUser: true }), makePost({ id: "2" })]);
    expect(await recordAiResult(db, "1", "a", 3)).toBe(false);
    expect(await db.posts.get("1")).toMatchObject({ folders: [], aiCheckedFoldersVersion: 3 });
    expect(await recordAiResult(db, "2", "gone", 3)).toBe(false);
    expect(await db.posts.get("2")).toMatchObject({ folders: [], aiCheckedFoldersVersion: 3 });
  });

  it("該当なし（null）は判定済みの版だけ記録する。無い投稿は false", async () => {
    await db.posts.put(makePost({ id: "1" }));
    expect(await recordAiResult(db, "1", null, 3)).toBe(false);
    expect((await db.posts.get("1"))?.aiCheckedFoldersVersion).toBe(3);
    expect(await recordAiResult(db, "nothing", null, 3)).toBe(false);
  });
});
