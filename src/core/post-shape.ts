import type { CapturedPost } from "./types";

/** 1 件の投稿で受け付ける上限（X Premium の長文も入るように本文は 2 万字） */
export const POST_LIMITS = { text: 20000, media: 10, links: 50, hashtags: 50, shortString: 2048 } as const;

const MEDIA_HOSTS = new Set(["pbs.twimg.com", "abs.twimg.com", "video.twimg.com"]);

function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** 画像・動画として表示してよい URL（X の配信サーバーの https だけ。追跡用の画像を読み込ませないため） */
export function isAllowedMediaUrl(url: string): boolean {
  const u = parseUrl(url);
  return u !== null && u.protocol === "https:" && MEDIA_HOSTS.has(u.hostname);
}

/** リンクとして開いてよい投稿の URL（https://x.com だけ） */
export function isPostUrl(url: string): boolean {
  const u = parseUrl(url);
  return u !== null && u.protocol === "https:" && u.hostname === "x.com";
}

/** 上限を超える部分を切り、許されない画像を外す（取り込み係が送る前に使う） */
export function clampCaptured(p: CapturedPost): CapturedPost {
  return {
    ...p,
    text: p.text.slice(0, POST_LIMITS.text),
    author: { ...p.author, avatarUrl: isAllowedMediaUrl(p.author.avatarUrl) ? p.author.avatarUrl : "" },
    media: p.media.filter((m) => isAllowedMediaUrl(m.url) && isAllowedMediaUrl(m.thumbUrl)).slice(0, POST_LIMITS.media),
    links: p.links.slice(0, POST_LIMITS.links),
    hashtags: p.hashtags.slice(0, POST_LIMITS.hashtags),
    ...(p.quoted ? { quoted: { ...p.quoted, text: p.quoted.text.slice(0, POST_LIMITS.text) } } : {}),
  };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isShortStr = (v: unknown): v is string => isStr(v) && v.length <= POST_LIMITS.shortString;
const isDigits = (v: unknown): v is string => isStr(v) && /^\d{1,25}$/.test(v);
const isText = (v: unknown): v is string => isStr(v) && v.length <= POST_LIMITS.text;
const MEDIA_TYPES = ["photo", "video", "gif"];

/** 外から来たデータ（ページ側・読み込みファイル）が投稿の形をしているか */
export function isCapturedPostShape(v: unknown): v is CapturedPost {
  if (!isObj(v)) return false;
  const a = v.author;
  const q = v.quoted;
  return (
    isDigits(v.id) &&
    isShortStr(v.url) &&
    isPostUrl(v.url) &&
    isText(v.text) &&
    isObj(a) &&
    isShortStr(a.id) &&
    isShortStr(a.handle) &&
    isShortStr(a.name) &&
    isShortStr(a.avatarUrl) &&
    (a.avatarUrl === "" || isAllowedMediaUrl(a.avatarUrl)) &&
    isShortStr(v.postedAt) &&
    Array.isArray(v.media) &&
    v.media.length <= POST_LIMITS.media &&
    v.media.every(
      (m) => isObj(m) && MEDIA_TYPES.includes(m.type as string) && isShortStr(m.url) && isShortStr(m.thumbUrl) && isAllowedMediaUrl(m.url) && isAllowedMediaUrl(m.thumbUrl),
    ) &&
    Array.isArray(v.links) &&
    v.links.length <= POST_LIMITS.links &&
    v.links.every((l) => isObj(l) && isShortStr(l.url) && isShortStr(l.domain)) &&
    Array.isArray(v.hashtags) &&
    v.hashtags.length <= POST_LIMITS.hashtags &&
    v.hashtags.every(isShortStr) &&
    (q === undefined || (isObj(q) && isDigits(q.id) && isShortStr(q.authorHandle) && isText(q.text))) &&
    (v.bookmarkOrder === undefined || isDigits(v.bookmarkOrder)) &&
    (v.partial === undefined || typeof v.partial === "boolean")
  );
}
