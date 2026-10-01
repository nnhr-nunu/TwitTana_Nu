import { afterEach, describe, expect, it } from "vitest";
import { createFolder } from "../db/folders";
import { getSettings, updateSettings } from "../db/settings";
import { makeCaptured, makePost } from "../test/factories";
import { openTestDb } from "../test/db";
import { handleRequest } from "./handlers";
import { isBgRequest } from "./protocol";

const NOW = "2026-10-02T00:00:00.000Z";
const db = openTestDb();
afterEach(async () => {
  await Promise.all([db.posts.clear(), db.folders.clear(), db.rules.clear(), db.kv.clear()]);
});

describe("isBgRequest", () => {
  it("知っている種類だけ受け付ける", () => {
    expect(isBgRequest({ type: "get-stats" })).toBe(true);
    expect(isBgRequest({ type: "drop-database" })).toBe(false);
    expect(isBgRequest("get-stats")).toBe(false);
  });
});

describe("handleRequest", () => {
  it("save-posts: ブクマとして保存し、全件数と成功日時を記録する", async () => {
    const res = await handleRequest(db, { type: "save-posts", posts: [makeCaptured({ id: "1" }), makeCaptured({ id: "2" })] }, NOW);
    expect(res).toEqual({ saved: 2, total: 2 });
    expect((await getSettings(db)).parseHealth.lastOkAt).toBe(NOW);
  });

  it("mark-removed: 解除済みの印をつける", async () => {
    await db.posts.put(makePost({ id: "1" }));
    expect(await handleRequest(db, { type: "mark-removed", postId: "1" }, NOW)).toEqual({ ok: true });
    expect((await db.posts.get("1"))?.removedOnX).toBe(true);
  });

  it("report-parse-error: 失敗日時と操作名を記録する", async () => {
    await handleRequest(db, { type: "report-parse-error", op: "Bookmarks" }, NOW);
    expect((await getSettings(db)).parseHealth).toEqual({ lastErrorAt: NOW, lastErrorOp: "Bookmarks" });
  });

  it("get-picker-state: 設定・フォルダ・その投稿の入っているフォルダ", async () => {
    const f = await createFolder(db, { name: "A" }, NOW);
    await db.posts.put(makePost({ id: "1", folders: [{ folderId: f.id, by: "rule" }] }));
    await updateSettings(db, { pickerOnBookmark: false });
    expect(await handleRequest(db, { type: "get-picker-state", postId: "1" }, NOW)).toEqual({ enabled: false, folders: [f], selected: [f.id] });
  });

  it("set-folder: 手で出し入れし、入っているフォルダを返す", async () => {
    const f = await createFolder(db, { name: "A" }, NOW);
    await db.posts.put(makePost({ id: "1" }));
    expect(await handleRequest(db, { type: "set-folder", postId: "1", folderId: f.id, on: true }, NOW)).toEqual({ selected: [f.id] });
    expect(await handleRequest(db, { type: "set-folder", postId: "1", folderId: f.id, on: false }, NOW)).toEqual({ selected: [] });
    expect((await db.posts.get("1"))?.sortedByUser).toBe(true);
  });

  it("create-folder: 作って投稿を入れる。名前が重なれば理由を返す", async () => {
    await db.posts.put(makePost({ id: "1" }));
    const res = await handleRequest(db, { type: "create-folder", name: "新しい", postId: "1" }, NOW);
    expect(res).toMatchObject({ ok: true, folder: { name: "新しい" } });
    const id = res && "folder" in res ? res.folder.id : "";
    expect(res).toMatchObject({ selected: [id] });
    expect(await handleRequest(db, { type: "create-folder", name: "新しい" }, NOW)).toEqual({ ok: false, error: "duplicate" });
    expect(await handleRequest(db, { type: "create-folder", name: " " }, NOW)).toEqual({ ok: false, error: "empty" });
  });

  it("get-stats: 全件数と読み取りの調子", async () => {
    await db.posts.bulkPut([makePost({ id: "1" }), makePost({ id: "2" })]);
    expect(await handleRequest(db, { type: "get-stats" }, NOW)).toEqual({ total: 2, health: {} });
  });
});
