import { domainOf } from "../core/normalize";
import type { CapturedPost, LinkItem, MediaItem, QuotedPost } from "../core/types";
import { snowflakeToIso } from "./graphql";

export type ExtractMode = "bookmarks" | "cache";
export type ExtractResult = { posts: CapturedPost[]; skipped: number };

type Obj = Record<string, unknown>;
const EMPTY: Obj = {};
const obj = (v: unknown): Obj => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Obj) : EMPTY);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : -1);

const TWEET_TYPES = new Set(["Tweet", "TweetWithVisibilityResults", "TweetTombstone", "TweetUnavailable"]);

/** 閲覧制限の包みを外す。削除済み・閲覧不可なら null */
function unwrap(node: unknown): Obj | null {
  const o = obj(node);
  if (o.__typename === "TweetWithVisibilityResults") return unwrap(o.tweet);
  if (o.__typename === "TweetTombstone" || o.__typename === "TweetUnavailable") return null;
  return str(o.rest_id) ? o : null;
}

function decodeEntities(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function toMedia(raw: unknown): MediaItem | null {
  const m = obj(raw);
  const base = str(m.media_url_https);
  const type = m.type === "photo" ? "photo" : m.type === "video" ? "video" : m.type === "animated_gif" ? "gif" : null;
  if (!type || !base) return null;
  if (type === "photo") return { type, url: base, thumbUrl: `${base}?name=small` };
  const best = arr(obj(m.video_info).variants)
    .map(obj)
    .filter((v) => v.content_type === "video/mp4" && str(v.url))
    .sort((a, b) => num(b.bitrate) - num(a.bitrate))[0];
  return { type, url: str(best?.url) ?? base, thumbUrl: base };
}

/** X の投稿オブジェクト（Tweet）を CapturedPost にする。必要な項目が無ければ null */
export function tweetToCaptured(raw: unknown): CapturedPost | null {
  const tweet = unwrap(raw);
  if (!tweet) return null;
  const id = str(tweet.rest_id);
  const legacy = obj(tweet.legacy);
  const user = obj(obj(obj(tweet.core).user_results).result);
  const handle = str(obj(user.core).screen_name) ?? str(obj(user.legacy).screen_name);
  if (!id || legacy === EMPTY || !handle) return null;

  const note = obj(obj(obj(tweet.note_tweet).note_tweet_results).result);
  const noteEntities = obj(note.entity_set);
  const entities = obj(legacy.entities);
  const urlEntities = [...arr(entities.urls), ...arr(noteEntities.urls)].map(obj);
  const extended = arr(obj(legacy.extended_entities).media);
  const mediaEntities = (extended.length ? extended : arr(entities.media)).map(obj);

  let text = str(note.text) ?? str(obj(note.richtext).text) ?? str(legacy.full_text) ?? "";
  for (const u of urlEntities) {
    const short = str(u.url);
    const expanded = str(u.expanded_url);
    if (short && expanded) text = text.split(short).join(expanded);
  }
  for (const m of mediaEntities) {
    const short = str(m.url);
    if (short) text = text.split(short).join("");
  }
  text = decodeEntities(text).trim();

  const links: LinkItem[] = [];
  for (const u of urlEntities) {
    const url = str(u.expanded_url);
    if (url && !links.some((l) => l.url === url)) links.push({ url, domain: domainOf(url) });
  }
  const hashtags = [...new Set([...arr(entities.hashtags), ...arr(noteEntities.hashtags)].map((h) => str(obj(h).text)).filter((h): h is string => !!h))];
  const media = mediaEntities.map(toMedia).filter((m): m is MediaItem => m !== null);

  const quotedPost = tweetToCaptured(obj(tweet.quoted_status_result).result);
  const quoted: QuotedPost | undefined = quotedPost
    ? { id: quotedPost.id, authorHandle: quotedPost.author.handle, text: quotedPost.text }
    : undefined;

  const createdAt = Date.parse(str(legacy.created_at) ?? "");
  const postedAt = snowflakeToIso(id) ?? (Number.isNaN(createdAt) ? "" : new Date(createdAt).toISOString());

  return {
    id,
    url: `https://x.com/${handle}/status/${id}`,
    text,
    author: {
      id: str(user.rest_id) ?? "",
      handle,
      name: str(obj(user.core).name) ?? str(obj(user.legacy).name) ?? handle,
      avatarUrl: str(obj(user.avatar).image_url) ?? str(obj(user.legacy).profile_image_url_https) ?? "",
    },
    postedAt,
    media,
    links,
    hashtags,
    ...(quoted ? { quoted } : {}),
  };
}

/**
 * X の返事 JSON から投稿を集める。
 * - bookmarks: 一覧の項目の投稿だけ（引用元やリポスト元は含めない）。項目の sortIndex を bookmarkOrder にする
 * - cache: 項目の投稿に加えて、リポスト元と引用元も集める（あとでブクマされたときの照合用）
 */
export function extractPosts(json: unknown, mode: ExtractMode): ExtractResult {
  const found = new Map<string, CapturedPost>();
  let skipped = 0;

  const add = (post: CapturedPost) => {
    if (!found.has(post.id)) found.set(post.id, post);
  };

  const visitTweet = (node: Obj, sortIndex: string | undefined) => {
    const tweet = unwrap(node);
    if (!tweet) return; // 削除済み・閲覧不可
    const post = tweetToCaptured(tweet);
    if (!post) {
      skipped++;
      return;
    }
    add(mode === "bookmarks" && sortIndex ? { ...post, bookmarkOrder: sortIndex } : post);
    if (mode === "cache") {
      for (const inner of [obj(obj(tweet.legacy).retweeted_status_result).result, obj(tweet.quoted_status_result).result]) {
        if (inner) walk(inner, undefined);
      }
    }
  };

  const walk = (node: unknown, sortIndex: string | undefined): void => {
    if (Array.isArray(node)) {
      for (const n of node) walk(n, sortIndex);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const o = node as Obj;
    if (typeof o.__typename === "string" && TWEET_TYPES.has(o.__typename)) {
      visitTweet(o, sortIndex);
      return;
    }
    const nextIndex = typeof o.entryId === "string" && typeof o.sortIndex === "string" ? o.sortIndex : sortIndex;
    for (const v of Object.values(o)) walk(v, nextIndex);
  };

  walk(json, undefined);
  return { posts: [...found.values()], skipped };
}
