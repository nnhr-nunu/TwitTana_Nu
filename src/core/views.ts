import { normalizeText } from "./normalize";
import { compareByBookmark, compareByPosted } from "./order";
import type { Post } from "./types";

export type View =
  | { kind: "all" }
  | { kind: "unsorted" }
  | { kind: "ai" }
  | { kind: "removed" }
  | { kind: "hidden" }
  | { kind: "folder"; folderId: string };

export type SortKey = "bookmark-desc" | "bookmark-asc" | "posted-desc" | "posted-asc";
export const SORT_KEYS: SortKey[] = ["bookmark-desc", "bookmark-asc", "posted-desc", "posted-asc"];

export function viewKey(v: View): string {
  return v.kind === "folder" ? `folder:${v.folderId}` : v.kind;
}

/** その投稿が絞り込みに入るか。非表示の投稿は「非表示にしたもの」にだけ入る */
export function inView(post: Post, view: View): boolean {
  if (view.kind === "hidden") return post.hidden;
  if (post.hidden) return false;
  switch (view.kind) {
    case "all":
      return true;
    case "unsorted":
      return post.folders.length === 0;
    case "ai":
      return post.folders.some((f) => f.by === "ai");
    case "removed":
      return post.removedOnX;
    case "folder":
      return post.folders.some((f) => f.folderId === view.folderId);
  }
}

/** 本文・表示名・@名・引用元の本文に検索語が含まれるか（全角半角・大文字小文字を区別しない） */
export function matchesQuery(post: Post, query: string): boolean {
  const q = normalizeText(query.trim());
  if (!q) return true;
  return [post.text, post.author.name, post.author.handle, post.quoted?.text ?? ""].some((s) => normalizeText(s).includes(q));
}

const SORTERS: Record<SortKey, (a: Post, b: Post) => number> = {
  "bookmark-desc": (a, b) => compareByBookmark(b, a),
  "bookmark-asc": compareByBookmark,
  "posted-desc": (a, b) => compareByPosted(b, a),
  "posted-asc": compareByPosted,
};

export function selectPosts(posts: Post[], opts: { view: View; query: string; sort: SortKey }): Post[] {
  return posts.filter((p) => inView(p, opts.view) && matchesQuery(p, opts.query)).sort(SORTERS[opts.sort]);
}

export type ViewCounts = { all: number; unsorted: number; ai: number; removed: number; hidden: number; folders: Record<string, number> };

export function viewCounts(posts: Post[]): ViewCounts {
  const counts: ViewCounts = { all: 0, unsorted: 0, ai: 0, removed: 0, hidden: 0, folders: {} };
  for (const p of posts) {
    if (p.hidden) {
      counts.hidden++;
      continue;
    }
    counts.all++;
    if (p.folders.length === 0) counts.unsorted++;
    if (p.folders.some((f) => f.by === "ai")) counts.ai++;
    if (p.removedOnX) counts.removed++;
    for (const f of p.folders) counts.folders[f.folderId] = (counts.folders[f.folderId] ?? 0) + 1;
  }
  return counts;
}
