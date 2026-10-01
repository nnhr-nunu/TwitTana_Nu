import { mergeCaptured } from "../core/merge";
import { withRuleFolders } from "../core/rules";
import type { CapturedPost, Post } from "../core/types";
import type { TwitTanaDB } from "./schema";

/** 同じ ID が複数あれば 1 つにまとめる（中身のある方を優先） */
function dedupe(items: CapturedPost[]): CapturedPost[] {
  const byId = new Map<string, CapturedPost>();
  for (const item of items) {
    const prev = byId.get(item.id);
    if (!prev || !item.partial || prev.partial) byId.set(item.id, item);
  }
  return [...byId.values()];
}

/** X から取り込んだ投稿を保存する。既にある投稿とは合流し、ルールを当てる */
export async function saveCaptured(
  db: TwitTanaDB,
  items: CapturedPost[],
  opts: { now: string; bookmarked: boolean },
): Promise<Post[]> {
  const unique = dedupe(items);
  if (unique.length === 0) return [];
  return db.transaction("rw", [db.posts, db.rules], async () => {
    const rules = await db.rules.toArray();
    const existing = await db.posts.bulkGet(unique.map((i) => i.id));
    const saved = unique.map((item, i) => {
      const merged = mergeCaptured(existing[i], item, opts);
      return withRuleFolders(merged, rules) ?? merged;
    });
    await db.posts.bulkPut(saved);
    return saved;
  });
}

export async function markRemovedOnX(db: TwitTanaDB, postId: string): Promise<void> {
  await db.posts.update(postId, { removedOnX: true });
}

export async function addToFolder(db: TwitTanaDB, postIds: string[], folderId: string): Promise<void> {
  await db.posts
    .where("id")
    .anyOf(postIds)
    .modify((p) => {
      p.sortedByUser = true;
      const found = p.folders.find((f) => f.folderId === folderId);
      if (found) found.by = "manual";
      else p.folders.push({ folderId, by: "manual" });
    });
}

export async function removeFromFolder(db: TwitTanaDB, postIds: string[], folderId: string): Promise<void> {
  await db.posts
    .where("id")
    .anyOf(postIds)
    .modify((p) => {
      p.sortedByUser = true;
      p.folders = p.folders.filter((f) => f.folderId !== folderId);
    });
}

export async function setHidden(db: TwitTanaDB, postIds: string[], hidden: boolean): Promise<void> {
  await db.posts.where("id").anyOf(postIds).modify({ hidden });
}

export async function markReviewed(db: TwitTanaDB, postId: string, now: string): Promise<void> {
  await db.posts
    .where("id")
    .equals(postId)
    .modify((p) => {
      p.review = { count: p.review.count + 1, lastAt: now };
    });
}

export async function listPosts(db: TwitTanaDB): Promise<Post[]> {
  return db.posts.toArray();
}
