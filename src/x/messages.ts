import type { CapturedPost } from "../core/types";

export const HOOK_SOURCE = "twittana-hook";
export const MAX_POSTS_PER_MESSAGE = 500;
const MAX_TEXT = 20000;

export type HookMessage =
  | { source: typeof HOOK_SOURCE; type: "bookmarks-seen"; posts: CapturedPost[] }
  | { source: typeof HOOK_SOURCE; type: "bookmark-added"; postId: string; post: CapturedPost | null }
  | { source: typeof HOOK_SOURCE; type: "bookmark-removed"; postId: string }
  | { source: typeof HOOK_SOURCE; type: "parse-error"; op: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isShortStr = (v: unknown): v is string => isStr(v) && v.length <= 2048;
const isDigits = (v: unknown): v is string => isStr(v) && /^\d{1,25}$/.test(v);
const MEDIA_TYPES = ["photo", "video", "gif"];

/** ページ側から来たデータが投稿の形をしているか（偽物・巨大なデータを捨てるため） */
export function isCapturedPost(v: unknown): v is CapturedPost {
  if (!isObj(v)) return false;
  const a = v.author;
  const q = v.quoted;
  return (
    isDigits(v.id) &&
    isStr(v.url) &&
    v.url.startsWith("https://x.com/") &&
    v.url.length <= 2048 &&
    isStr(v.text) &&
    v.text.length <= MAX_TEXT &&
    isObj(a) &&
    isShortStr(a.id) &&
    isShortStr(a.handle) &&
    isShortStr(a.name) &&
    isShortStr(a.avatarUrl) &&
    isShortStr(v.postedAt) &&
    Array.isArray(v.media) &&
    v.media.length <= 10 &&
    v.media.every((m) => isObj(m) && MEDIA_TYPES.includes(m.type as string) && isShortStr(m.url) && isShortStr(m.thumbUrl)) &&
    Array.isArray(v.links) &&
    v.links.length <= 50 &&
    v.links.every((l) => isObj(l) && isShortStr(l.url) && isShortStr(l.domain)) &&
    Array.isArray(v.hashtags) &&
    v.hashtags.length <= 50 &&
    v.hashtags.every(isShortStr) &&
    (q === undefined || (isObj(q) && isDigits(q.id) && isShortStr(q.authorHandle) && isStr(q.text) && q.text.length <= MAX_TEXT)) &&
    (v.bookmarkOrder === undefined || isDigits(v.bookmarkOrder)) &&
    (v.partial === undefined || typeof v.partial === "boolean")
  );
}

export function isHookMessage(v: unknown): v is HookMessage {
  if (!isObj(v) || v.source !== HOOK_SOURCE) return false;
  switch (v.type) {
    case "bookmarks-seen":
      return Array.isArray(v.posts) && v.posts.length <= MAX_POSTS_PER_MESSAGE && v.posts.every(isCapturedPost);
    case "bookmark-added":
      return isDigits(v.postId) && (v.post === null || (isCapturedPost(v.post) && v.post.id === v.postId));
    case "bookmark-removed":
      return isDigits(v.postId);
    case "parse-error":
      return isShortStr(v.op);
    default:
      return false;
  }
}
