import { createFolder, FolderNameError, listFolders } from "../db/folders";
import { addToFolder, markRemovedOnX, removeFromFolder, saveCaptured } from "../db/posts";
import type { TwitTanaDB } from "../db/schema";
import { getSettings, updateSettings } from "../db/settings";
import type { BgRequest, BgResponseMap } from "./protocol";

async function selectedFolders(db: TwitTanaDB, postId: string): Promise<string[]> {
  return (await db.posts.get(postId))?.folders.map((f) => f.folderId) ?? [];
}

/** 裏方への依頼を処理する。db を引数で受け取るのはテストのため */
export async function handleRequest(db: TwitTanaDB, req: BgRequest, now: string): Promise<BgResponseMap[BgRequest["type"]]> {
  switch (req.type) {
    case "save-posts": {
      const saved = await saveCaptured(db, req.posts, { now, bookmarked: true });
      if (saved.length > 0) {
        const { parseHealth } = await getSettings(db);
        await updateSettings(db, { parseHealth: { ...parseHealth, lastOkAt: now } });
      }
      return { saved: saved.length, total: await db.posts.count() };
    }
    case "mark-removed":
      await markRemovedOnX(db, req.postId);
      return { ok: true };
    case "report-parse-error": {
      const { parseHealth } = await getSettings(db);
      await updateSettings(db, { parseHealth: { ...parseHealth, lastErrorAt: now, lastErrorOp: req.op } });
      return { ok: true };
    }
    case "get-picker-state": {
      const [settings, folders, selected] = await Promise.all([getSettings(db), listFolders(db), selectedFolders(db, req.postId)]);
      return { enabled: settings.pickerOnBookmark, folders, selected, language: settings.language };
    }
    case "set-folder":
      if (req.on) await addToFolder(db, [req.postId], req.folderId);
      else await removeFromFolder(db, [req.postId], req.folderId);
      return { selected: await selectedFolders(db, req.postId) };
    case "create-folder":
      try {
        const folder = await createFolder(db, { name: req.name }, now);
        if (req.postId) await addToFolder(db, [req.postId], folder.id);
        return { ok: true, folder, selected: req.postId ? await selectedFolders(db, req.postId) : [] };
      } catch (e) {
        if (e instanceof FolderNameError) return { ok: false, error: e.code };
        throw e;
      }
    case "get-stats": {
      const settings = await getSettings(db);
      return { total: await db.posts.count(), health: settings.parseHealth, language: settings.language };
    }
    case "refresh-badge":
      return { ok: true };
  }
}
