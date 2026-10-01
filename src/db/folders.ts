import { normalizeText } from "../core/normalize";
import type { Folder } from "../core/types";
import type { TwitTanaDB } from "./schema";
import { bumpFoldersVersion } from "./settings";

export class FolderNameError extends Error {
  constructor(readonly code: "empty" | "duplicate") {
    super(code);
    this.name = "FolderNameError";
  }
}

async function checkName(db: TwitTanaDB, name: string, exceptId?: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new FolderNameError("empty");
  const key = normalizeText(trimmed);
  const all = await db.folders.toArray();
  if (all.some((f) => f.id !== exceptId && normalizeText(f.name) === key)) throw new FolderNameError("duplicate");
  return trimmed;
}

export async function listFolders(db: TwitTanaDB): Promise<Folder[]> {
  return db.folders.orderBy("order").toArray();
}

export async function createFolder(
  db: TwitTanaDB,
  input: { name: string; description?: string },
  now: string,
): Promise<Folder> {
  return db.transaction("rw", [db.folders, db.kv], async () => {
    const name = await checkName(db, input.name);
    const last = await db.folders.orderBy("order").last();
    const folder: Folder = {
      id: crypto.randomUUID(),
      name,
      description: input.description?.trim() ?? "",
      order: (last?.order ?? -1) + 1,
      createdAt: now,
    };
    await db.folders.add(folder);
    await bumpFoldersVersion(db);
    return folder;
  });
}

export async function updateFolder(
  db: TwitTanaDB,
  id: string,
  patch: { name?: string; description?: string },
): Promise<Folder> {
  return db.transaction("rw", [db.folders, db.kv], async () => {
    const current = await db.folders.get(id);
    if (!current) throw new Error(`folder not found: ${id}`);
    const next: Folder = {
      ...current,
      name: patch.name === undefined ? current.name : await checkName(db, patch.name, id),
      description: patch.description === undefined ? current.description : patch.description.trim(),
    };
    await db.folders.put(next);
    await bumpFoldersVersion(db);
    return next;
  });
}

export async function reorderFolders(db: TwitTanaDB, idsInOrder: string[]): Promise<void> {
  await db.transaction("rw", db.folders, async () => {
    await Promise.all(idsInOrder.map((id, order) => db.folders.update(id, { order })));
  });
}

/** フォルダを消す。投稿から外し、そのフォルダ宛てのルールも消す */
export async function deleteFolder(db: TwitTanaDB, id: string): Promise<void> {
  await db.transaction("rw", [db.folders, db.posts, db.rules, db.kv], async () => {
    await db.folders.delete(id);
    await db.rules.where("folderId").equals(id).delete();
    await db.posts.toCollection().modify((p) => {
      if (p.folders.some((f) => f.folderId === id)) p.folders = p.folders.filter((f) => f.folderId !== id);
    });
    await bumpFoldersVersion(db);
  });
}
