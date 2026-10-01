import { AI_EXAMPLE_TEXT_LIMIT, AI_EXAMPLES_PER_FOLDER, truncate, type AiFolder } from "../core/ai-prompt";
import { compareByBookmark } from "../core/order";
import type { Post } from "../core/types";
import { listFolders } from "./folders";
import type { TwitTanaDB } from "./schema";

export const AI_BATCH_SIZE = 20;

function isAiCandidate(p: Post, foldersVersion: number): boolean {
  return !p.hidden && !p.sortedByUser && !p.partial && p.folders.length === 0 && p.aiCheckedFoldersVersion !== foldersVersion;
}

/** AI にかける投稿（新しいブクマ順） */
export async function aiCandidates(db: TwitTanaDB, foldersVersion: number, limit = AI_BATCH_SIZE): Promise<Post[]> {
  const posts = await db.posts.filter((p) => isAiCandidate(p, foldersVersion)).toArray();
  return posts.sort((a, b) => compareByBookmark(b, a)).slice(0, limit);
}

export async function countAiCandidates(db: TwitTanaDB, foldersVersion: number): Promise<number> {
  return db.posts.filter((p) => isAiCandidate(p, foldersVersion)).count();
}

/** AI に渡すフォルダ。手で入れた投稿の本文を例として添える */
export async function aiFolders(db: TwitTanaDB): Promise<AiFolder[]> {
  const [folders, manual] = await Promise.all([
    listFolders(db),
    db.posts.filter((p) => !p.hidden && p.folders.some((f) => f.by === "manual")).toArray(),
  ]);
  return folders.map((f) => ({
    id: f.id,
    name: f.name,
    description: f.description,
    examples: manual
      .filter((p) => p.folders.some((a) => a.folderId === f.id && a.by === "manual") && p.text)
      .slice(0, AI_EXAMPLES_PER_FOLDER)
      .map((p) => truncate(p.text, AI_EXAMPLE_TEXT_LIMIT)),
  }));
}

/**
 * AI の結果を記録する。どの場合も判定済みの版は記録する。
 * まだ未整理で手で整理されておらず、フォルダが実在するときだけ by: "ai" で入れ、true を返す。
 */
export async function recordAiResult(db: TwitTanaDB, postId: string, folderId: string | null, foldersVersion: number): Promise<boolean> {
  return db.transaction("rw", [db.posts, db.folders], async () => {
    const post = await db.posts.get(postId);
    if (!post) return false;
    const folderExists = folderId !== null && (await db.folders.get(folderId)) !== undefined;
    const canSort = folderExists && folderId !== null && !post.sortedByUser && !post.hidden && post.folders.length === 0;
    await db.posts.put({
      ...post,
      aiCheckedFoldersVersion: foldersVersion,
      folders: canSort ? [{ folderId, by: "ai" }] : post.folders,
    });
    return canSort;
  });
}
