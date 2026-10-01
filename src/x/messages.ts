import { isCapturedPostShape } from "../core/post-shape";
import type { CapturedPost } from "../core/types";

export const HOOK_SOURCE = "twittana-hook";
export const MAX_POSTS_PER_MESSAGE = 500;

/** 取り込み係 → 橋渡し係。ページ側から偽物が来うるので、投稿の中身は受け取った側で splitValidPosts で調べる */
export type HookMessage =
  | { source: typeof HOOK_SOURCE; type: "bookmarks-seen"; posts: unknown[] }
  | { source: typeof HOOK_SOURCE; type: "bookmark-added"; postId: string; post: unknown }
  | { source: typeof HOOK_SOURCE; type: "bookmark-removed"; postId: string }
  | { source: typeof HOOK_SOURCE; type: "parse-error"; op: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isDigits = (v: unknown): v is string => typeof v === "string" && /^\d{1,25}$/.test(v);

export function isHookMessage(v: unknown): v is HookMessage {
  if (!isObj(v) || v.source !== HOOK_SOURCE) return false;
  switch (v.type) {
    case "bookmarks-seen":
      return Array.isArray(v.posts) && v.posts.length <= MAX_POSTS_PER_MESSAGE;
    case "bookmark-added":
      return isDigits(v.postId) && (v.post === null || (isObj(v.post) && v.post.id === v.postId));
    case "bookmark-removed":
      return isDigits(v.postId);
    case "parse-error":
      return typeof v.op === "string" && v.op.length <= 200;
    default:
      return false;
  }
}

/** 正しい形の投稿だけを残す。1 件の不正で同じ返事の投稿を全部捨てないため */
export function splitValidPosts(posts: unknown[]): { valid: CapturedPost[]; invalid: number } {
  const valid = posts.filter(isCapturedPostShape);
  return { valid, invalid: posts.length - valid.length };
}
