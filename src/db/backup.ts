import { buildExport, type ExportFile } from "../core/export-format";
import { mergeImported } from "../core/merge";
import { normalizeText } from "../core/normalize";
import type { FolderAssignment, Post } from "../core/types";
import { listFolders } from "./folders";
import { listRules } from "./rules-repo";
import type { TwitTanaDB } from "./schema";
import { bumpFoldersVersion } from "./settings";

export type ImportSummary = { posts: number; folders: number; rules: number };

export async function exportAll(db: TwitTanaDB, now: string): Promise<ExportFile> {
  const [folders, rules, posts] = await Promise.all([listFolders(db), listRules(db), db.posts.toArray()]);
  return buildExport({ folders, rules, posts }, now);
}

function uniqueFolders(folders: FolderAssignment[]): FolderAssignment[] {
  const seen = new Set<string>();
  return folders.filter((f) => {
    if (seen.has(f.folderId)) return false;
    seen.add(f.folderId);
    return true;
  });
}

/**
 * 書き出しファイルを読み込む（parseImport で検査済みのもの）。
 * フォルダは ID か名前（全角半角を区別しない）が同じなら手元のものにまとめる。
 * どこにも無いフォルダ宛てのルールと振り分けは捨てる。
 */
export async function importFile(db: TwitTanaDB, file: ExportFile): Promise<ImportSummary> {
  return db.transaction("rw", [db.posts, db.folders, db.rules, db.kv], async () => {
    const localFolders = await db.folders.toArray();
    const idMap = new Map<string, string>();
    let nextFolderOrder = localFolders.reduce((max, f) => Math.max(max, f.order), -1) + 1;
    let addedFolders = 0;
    for (const f of [...file.folders].sort((a, b) => a.order - b.order)) {
      const local =
        localFolders.find((l) => l.id === f.id) ??
        localFolders.find((l) => normalizeText(l.name) === normalizeText(f.name));
      if (local) {
        idMap.set(f.id, local.id);
        continue;
      }
      const created = { ...f, order: nextFolderOrder++ };
      await db.folders.add(created);
      localFolders.push(created);
      idMap.set(f.id, f.id);
      addedFolders++;
    }

    const localRules = await db.rules.toArray();
    let nextRuleOrder = localRules.reduce((max, r) => Math.max(max, r.order), -1) + 1;
    let addedRules = 0;
    for (const r of [...file.rules].sort((a, b) => a.order - b.order)) {
      const folderId = idMap.get(r.folderId);
      if (!folderId || localRules.some((l) => l.id === r.id)) continue;
      await db.rules.add({ ...r, folderId, order: nextRuleOrder++ });
      addedRules++;
    }

    const remapped: Post[] = file.posts.map((p) => ({
      ...p,
      folders: uniqueFolders(
        p.folders.flatMap((f) => {
          const id = idMap.get(f.folderId);
          return id ? [{ ...f, folderId: id }] : [];
        }),
      ),
    }));
    const existing = await db.posts.bulkGet(remapped.map((p) => p.id));
    const merged = remapped.map((p, i) => mergeImported(existing[i], p));
    await db.posts.bulkPut(merged);

    if (addedFolders > 0) await bumpFoldersVersion(db);
    return { posts: merged.length, folders: addedFolders, rules: addedRules };
  });
}
