import { afterEach, describe, expect, it } from "vitest";
import { buildExport } from "../core/export-format";
import type { Folder, Rule } from "../core/types";
import { makePost } from "../test/factories";
import { openTestDb } from "../test/db";
import { exportAll, importFile } from "./backup";
import { createFolder, listFolders } from "./folders";
import { listRules } from "./rules-repo";
import { getSettings } from "./settings";

const NOW = "2026-10-02T00:00:00.000Z";
const db = openTestDb();
afterEach(async () => {
  await Promise.all([db.posts.clear(), db.rules.clear(), db.folders.clear(), db.kv.clear()]);
});

const folder = (over: Partial<Folder>): Folder => ({ id: "f", name: "A", description: "", order: 0, createdAt: NOW, ...over });
const rule = (over: Partial<Rule>): Rule => ({ id: "r", folderId: "f", conditions: [{ kind: "keyword", value: "x" }], enabled: true, order: 0, ...over });

describe("exportAll → importFile", () => {
  it("空の DB に読み込むと同じ中身になる", async () => {
    const f = await createFolder(db, { name: "ゲーム" }, NOW);
    await db.rules.put(rule({ id: "r1", folderId: f.id }));
    await db.posts.put(makePost({ id: "1", folders: [{ folderId: f.id, by: "manual" }], sortedByUser: true }));
    const file = await exportAll(db, NOW);

    const other = openTestDb();
    const summary = await importFile(other, file);
    expect(summary).toEqual({ posts: 1, folders: 1, rules: 1 });
    expect(await listFolders(other)).toEqual(await listFolders(db));
    expect(await listRules(other)).toEqual(await listRules(db));
    expect(await other.posts.get("1")).toEqual(await db.posts.get("1"));
    await other.delete();
  });
});

describe("importFile", () => {
  it("同じ名前で ID の違うフォルダは手元のフォルダにまとめる", async () => {
    const local = await createFolder(db, { name: "ゲーム" }, NOW);
    const file = buildExport(
      {
        folders: [folder({ id: "imported", name: "ｹﾞｰﾑ" })],
        rules: [rule({ id: "r9", folderId: "imported" })],
        posts: [makePost({ id: "1", folders: [{ folderId: "imported", by: "manual" }] })],
      },
      NOW,
    );
    const summary = await importFile(db, file);
    expect(summary).toEqual({ posts: 1, folders: 0, rules: 1 });
    expect((await listFolders(db)).map((f) => f.id)).toEqual([local.id]);
    expect((await db.posts.get("1"))?.folders).toEqual([{ folderId: local.id, by: "manual" }]);
    expect((await db.rules.get("r9"))?.folderId).toBe(local.id);
  });

  it("既にある投稿とは合流し、手元の整理を残す", async () => {
    const a = await createFolder(db, { name: "A" }, NOW);
    await db.posts.put(makePost({ id: "1", folders: [{ folderId: a.id, by: "manual" }] }));
    const file = buildExport(
      { folders: [folder({ id: "b", name: "B" })], rules: [], posts: [makePost({ id: "1", folders: [{ folderId: "b", by: "rule" }] })] },
      NOW,
    );
    await importFile(db, file);
    expect((await db.posts.get("1"))?.folders).toEqual([
      { folderId: a.id, by: "manual" },
      { folderId: "b", by: "rule" },
    ]);
  });

  it("どこにも無いフォルダ宛てのルールと振り分けは捨てる", async () => {
    const file = buildExport(
      { folders: [], rules: [rule({ id: "r1", folderId: "ghost" })], posts: [makePost({ id: "1", folders: [{ folderId: "ghost", by: "manual" }] })] },
      NOW,
    );
    expect(await importFile(db, file)).toEqual({ posts: 1, folders: 0, rules: 0 });
    expect((await db.posts.get("1"))?.folders).toEqual([]);
  });

  it("フォルダが増えたときだけフォルダの版を上げる", async () => {
    const before = (await getSettings(db)).foldersVersion;
    await importFile(db, buildExport({ folders: [], rules: [], posts: [] }, NOW));
    expect((await getSettings(db)).foldersVersion).toBe(before);
    await importFile(db, buildExport({ folders: [folder({ id: "n", name: "新" })], rules: [], posts: [] }, NOW));
    expect((await getSettings(db)).foldersVersion).toBe(before + 1);
  });
});
