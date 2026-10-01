import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../core/types";
import { openTestDb } from "../test/db";
import { bumpFoldersVersion, getSettings, updateSettings } from "./settings";

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
});
