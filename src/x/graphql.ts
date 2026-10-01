const GRAPHQL_PATH = /\/i\/api\/graphql\/[^/?#]+\/([A-Za-z0-9_]+)/;
const TWITTER_EPOCH_MS = 1288834974657n;

/** X の GraphQL の URL から操作名（Bookmarks など）を取り出す */
export function graphqlOperation(url: string): string | null {
  return GRAPHQL_PATH.exec(url)?.[1] ?? null;
}

/** ブクマ一覧（すべて・検索・Premium のフォルダ）の操作か */
export function isBookmarkListOp(op: string): boolean {
  return op === "Bookmarks" || (op.startsWith("Bookmark") && op.endsWith("Timeline"));
}

export type BookmarkMutation = "add" | "remove";

export function bookmarkMutation(op: string): BookmarkMutation | null {
  if (op === "CreateBookmark") return "add";
  if (op === "DeleteBookmark") return "remove";
  return null;
}

/** ブクマ操作の送信本文から投稿 ID を取り出す */
export function tweetIdFromBody(body: unknown): string | null {
  let data: unknown = body;
  if (typeof body === "string") {
    try {
      data = JSON.parse(body);
    } catch {
      return null;
    }
  }
  if (typeof data !== "object" || data === null) return null;
  const vars = (data as { variables?: unknown }).variables;
  if (typeof vars !== "object" || vars === null) return null;
  const id = (vars as { tweet_id?: unknown }).tweet_id;
  return typeof id === "string" && /^\d+$/.test(id) ? id : null;
}

/** 投稿 ID（snowflake）に埋め込まれた投稿日時。古い形式の ID なら null */
export function snowflakeToIso(id: string): string | null {
  if (!/^\d{1,20}$/.test(id)) return null;
  const ms = (BigInt(id) >> 22n) + TWITTER_EPOCH_MS;
  if (ms <= TWITTER_EPOCH_MS) return null;
  return new Date(Number(ms)).toISOString();
}
