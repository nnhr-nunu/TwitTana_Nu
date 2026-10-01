import { DEFAULT_SETTINGS, type Settings } from "../core/types";
import type { TwitTanaDB } from "./schema";

const KEY = "settings";

export async function getSettings(db: TwitTanaDB): Promise<Settings> {
  const row = await db.kv.get(KEY);
  return { ...DEFAULT_SETTINGS, ...(row?.value as Partial<Settings> | undefined) };
}

export async function updateSettings(db: TwitTanaDB, patch: Partial<Settings>): Promise<Settings> {
  return db.transaction("rw", db.kv, async () => {
    const next = { ...(await getSettings(db)), ...patch };
    await db.kv.put({ key: KEY, value: next });
    return next;
  });
}

/** フォルダの構成が変わったことを記録する（AI の再判定用） */
export async function bumpFoldersVersion(db: TwitTanaDB): Promise<number> {
  return db.transaction("rw", db.kv, async () => {
    const v = (await getSettings(db)).foldersVersion + 1;
    await updateSettings(db, { foldersVersion: v });
    return v;
  });
}
