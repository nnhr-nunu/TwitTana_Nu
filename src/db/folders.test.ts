import { afterEach, describe, expect, it } from "vitest";
import { makePost } from "../test/factories";
import { openTestDb } from "../test/db";
import { createFolder, deleteFolder, FolderNameError, listFolders, reorderFolders, updateFolder } from "./folders";
import { getSettings } from "./settings";

const NOW = "2026-10-02T00:00:00.000Z";
const db = openTestDb();
afterEach(async () => {
  await Promise.all([db.folders.clear(), db.posts.clear(), db.rules.clear(), db.kv.clear()]);
});

describe("createFolder", () => {
  it("名前の前後の空白を除き、並び順を末尾にする", async () => {
    const a = await createFolder(db, { name: " ゲーム " }, NOW);
    const b = await createFolder(db, { name: "料理", description: "レシピ" }, NOW);
    expect(a).toMatchObject({ name: "ゲーム", description: "", order: 0, createdAt: NOW });
    expect(b).toMatchObject({ name: "料理", description: "レシピ", order: 1 });
    expect((await listFolders(db)).map((f) => f.name)).toEqual(["ゲーム", "料理"]);
  });
  it("空の名前と、全角半角だけ違う同じ名前は断る", async () => {
    await createFolder(db, { name: "Unity" }, NOW);
    await expect(createFolder(db, { name: "  " }, NOW)).rejects.toMatchObject({ code: "empty" });
    await expect(createFolder(db, { name: "ＵＮＩＴＹ" }, NOW)).rejects.toBeInstanceOf(FolderNameError);
  });
  it("作るとフォルダの版が上がる", async () => {
    const before = (await getSettings(db)).foldersVersion;
    await createFolder(db, { name: "A" }, NOW);
    expect((await getSettings(db)).foldersVersion).toBe(before + 1);
  });
});

describe("updateFolder", () => {
  it("名前と説明を変え、版を上げる。自分と同じ名前はそのままでよい", async () => {
    const f = await createFolder(db, { name: "A" }, NOW);
    const before = (await getSettings(db)).foldersVersion;
    const g = await updateFolder(db, f.id, { name: "A", description: "説明" });
    expect(g).toMatchObject({ name: "A", description: "説明" });
    expect((await getSettings(db)).foldersVersion).toBe(before + 1);
  });
});

describe("reorderFolders", () => {
  it("渡した順に並べ替える", async () => {
    const a = await createFolder(db, { name: "A" }, NOW);
    const b = await createFolder(db, { name: "B" }, NOW);
    await reorderFolders(db, [b.id, a.id]);
    expect((await listFolders(db)).map((f) => f.name)).toEqual(["B", "A"]);
  });
});

describe("deleteFolder", () => {
  it("投稿から外し、そのフォルダ宛てのルールも消す", async () => {
    const a = await createFolder(db, { name: "A" }, NOW);
    const b = await createFolder(db, { name: "B" }, NOW);
    await db.posts.bulkPut([
      makePost({ id: "1", folders: [{ folderId: a.id, by: "manual" }, { folderId: b.id, by: "rule" }] }),
      makePost({ id: "2", folders: [{ folderId: a.id, by: "ai" }] }),
    ]);
    await db.rules.bulkPut([
      { id: "r1", folderId: a.id, conditions: [{ kind: "keyword", value: "x" }], enabled: true, order: 0 },
      { id: "r2", folderId: b.id, conditions: [{ kind: "keyword", value: "y" }], enabled: true, order: 1 },
    ]);
    await deleteFolder(db, a.id);
    expect((await db.posts.get("1"))?.folders).toEqual([{ folderId: b.id, by: "rule" }]);
    expect((await db.posts.get("2"))?.folders).toEqual([]);
    expect((await db.rules.toArray()).map((r) => r.id)).toEqual(["r2"]);
    expect((await listFolders(db)).map((f) => f.name)).toEqual(["B"]);
  });
});
