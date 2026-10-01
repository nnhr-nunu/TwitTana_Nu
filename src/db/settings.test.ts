import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../core/types";
import { openTestDb } from "../test/db";
import { bumpFoldersVersion, getSettings, updateParseHealth, updateSettings } from "./settings";

const db = openTestDb();
afterEach(async () => {
  await db.kv.clear();
});

describe("settings", () => {
  it("保存が無ければ初期値", async () => {
    expect(await getSettings(db)).toEqual(DEFAULT_SETTINGS);
  });
  it("一部だけ変えられる", async () => {
    await updateSettings(db, { reviewPerDay: 10 });
    expect(await getSettings(db)).toEqual({ ...DEFAULT_SETTINGS, reviewPerDay: 10 });
  });
  it("フォルダの版を 1 つ上げる", async () => {
    expect(await bumpFoldersVersion(db)).toBe(DEFAULT_SETTINGS.foldersVersion + 1);
    expect((await getSettings(db)).foldersVersion).toBe(DEFAULT_SETTINGS.foldersVersion + 1);
  });
  it("読み取りの調子は、同時に更新しても両方残る", async () => {
    await Promise.all([
      updateParseHealth(db, (h) => ({ ...h, lastOkAt: "2026-10-02T00:00:00.000Z" })),
      updateParseHealth(db, (h) => ({ ...h, lastErrorAt: "2026-10-02T00:00:01.000Z", lastErrorOp: "Bookmarks" })),
    ]);
    expect((await getSettings(db)).parseHealth).toEqual({
      lastOkAt: "2026-10-02T00:00:00.000Z",
      lastErrorAt: "2026-10-02T00:00:01.000Z",
      lastErrorOp: "Bookmarks",
    });
  });
});
