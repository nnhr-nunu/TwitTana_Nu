import { afterEach, describe, expect, it } from "vitest";
import { makePost } from "../test/factories";
import { openTestDb } from "../test/db";
import { createFolder } from "./folders";
import { applyRulesToUnsorted, deleteRule, listRules, saveRule } from "./rules-repo";

const NOW = "2026-10-02T00:00:00.000Z";
const db = openTestDb();
afterEach(async () => {
  await Promise.all([db.posts.clear(), db.rules.clear(), db.folders.clear(), db.kv.clear()]);
});

describe("saveRule / listRules / deleteRule", () => {
  it("新しいルールは末尾に、既存は並び順を保って更新", async () => {
    const f = await createFolder(db, { name: "A" }, NOW);
    const r1 = await saveRule(db, { folderId: f.id, conditions: [{ kind: "keyword", value: "x" }], enabled: true });
    const r2 = await saveRule(db, { folderId: f.id, conditions: [{ kind: "keyword", value: "y" }], enabled: true });
    await saveRule(db, { id: r1.id, folderId: f.id, conditions: [{ kind: "keyword", value: "z" }], enabled: false });
    const rules = await listRules(db);
    expect(rules.map((r) => [r.id, r.order, r.enabled])).toEqual([
      [r1.id, 0, false],
      [r2.id, 1, true],
    ]);
    await deleteRule(db, r1.id);
    expect((await listRules(db)).map((r) => r.id)).toEqual([r2.id]);
  });
  it("無いフォルダ宛てのルールは断る", async () => {
    await expect(saveRule(db, { folderId: "nothing", conditions: [], enabled: true })).rejects.toThrow("folder not found");
  });
});

describe("applyRulesToUnsorted", () => {
  it("未整理で、手で整理していない投稿にだけ当てて、変わった件数を返す", async () => {
    const f = await createFolder(db, { name: "A" }, NOW);
    await saveRule(db, { folderId: f.id, conditions: [{ kind: "keyword", value: "unity" }], enabled: true });
    await db.posts.bulkPut([
      makePost({ id: "1", text: "unity" }),
      makePost({ id: "2", text: "unity", sortedByUser: true }),
      makePost({ id: "3", text: "unity", folders: [{ folderId: "other", by: "ai" }] }),
      makePost({ id: "4", text: "ほか" }),
    ]);
    expect(await applyRulesToUnsorted(db)).toBe(1);
    expect((await db.posts.get("1"))?.folders).toEqual([{ folderId: f.id, by: "rule" }]);
    expect((await db.posts.get("2"))?.folders).toEqual([]);
    expect((await db.posts.get("3"))?.folders).toEqual([{ folderId: "other", by: "ai" }]);
  });
});
