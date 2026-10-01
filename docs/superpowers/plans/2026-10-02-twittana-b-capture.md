# ツイッ棚 計画2：X からの取り込み Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** x.com の画面が受け取ったデータを横で読み、ブクマを拡張の DB に保存する。ブクマした瞬間のフォルダ選択メニューと、ブクマ画面の「N 件取り込み」表示も作る。

**Architecture:** 取り込み係（MAIN world の content script）が `fetch` と `XMLHttpRequest` を包み、X の GraphQL の返事を複製して読む。読み取った投稿は `window.postMessage` で橋渡し係（通常の content script）へ渡し、橋渡し係が `runtime.sendMessage` で裏方（background）に保存させる。X の DOM や通信の形に依存するコードはすべて `src/x/` に置く。

**Tech Stack:** 計画1と同じ（WXT 0.21 / React 19 / Dexie 4 / Vitest 5）＋ happy-dom、@testing-library/react

**Spec:** [`docs/superpowers/specs/2026-10-02-twittana-design.md`](../specs/2026-10-02-twittana-design.md)（6・8・9 章の手動とメニュー、13 章のうち取り込み部分）

**前提:** 計画1（[`2026-10-02-twittana-a-foundation.md`](./2026-10-02-twittana-a-foundation.md)）が完了していること。使う関数: `saveCaptured`・`markRemovedOnX`・`addToFolder`・`removeFromFolder`（`src/db/posts.ts`）、`createFolder`・`listFolders`・`FolderNameError`（`src/db/folders.ts`）、`getSettings`・`updateSettings`（`src/db/settings.ts`）、`remainingReviewCount`（`src/db/review-repo.ts`）、`getDb`・`TwitTanaDB`（`src/db/schema.ts`）、`domainOf`（`src/core/normalize.ts`）、`localDateString`（`src/core/review.ts`）、型 `CapturedPost`・`Folder`・`ParseHealth`（`src/core/types.ts`）、`makeCaptured`（`src/test/factories.ts`）、`openTestDb`（`src/test/db.ts`）。

## Global Constraints

- 計画1の Global Constraints をすべて守る
- 拡張から X へ自分でリクエストを送らない。自動スクロール・自動クリックもしない（AGENTS.md）
- X の DOM セレクタ（`data-testid` など）と X の通信データの形に触れるコードは `src/x/` だけに置く
- MAIN world の取り込み係は拡張 API（`browser`）を使わない
- 取り込み係の処理で例外が起きても、X の画面には漏らさない（`try/catch` で握りつぶし、元の通信の結果をそのまま返す）
- 取り込み係は DM など投稿一覧以外のデータを保存・送信しない
- 画面の文言は日本語で直書き（英語対応は計画4）
- tsconfig は `strict`・`noUncheckedIndexedAccess`（配列の `[0]` などは `undefined` かもしれない扱い）・`verbatimModuleSyntax`（型だけの import は `import type` か `type` 指定）。計画1の実装でもこの 3 つに合わせて直した箇所がある

## Review Focus

- ブクマ一覧の投稿が引用している別の投稿まで、ブクマとして保存してしまう → 一覧の項目の投稿だけを保存すべき（Task 2 のテスト）
- 削除済み・閲覧不可の投稿（tombstone）がブクマ一覧に混ざる → 黙って飛ばし、エラー表示にしないべき（Task 2 のテスト）
- ページ側のスクリプトが偽物や巨大なメッセージを送ってくる → 橋渡し係は形と件数を検査して捨てるべき（Task 3 のテスト）
- 返事が JSON でない・読み取りで例外が出る → X の `fetch` の結果は変えずに返すべき（Task 4 のテスト）
- ブクマした投稿が覚えておいた中にも画面にも見つからない → ID と URL だけの投稿として保存し、あとで中身が埋まるべき（Task 6 のテスト。埋まる側は計画1の合流で確認済み）

---

## File Structure

| ファイル | 役割 |
|---|---|
| `src/x/graphql.ts` | URL から操作名を取り出す、ブクマ一覧・ブクマ操作の判定、送信本文から投稿 ID、投稿 ID から投稿日時 |
| `src/x/test-builders.ts` | テスト用に X の返事の形をした JSON を作る関数（実データは使わない） |
| `src/x/parse.ts` | X の返事 JSON → `CapturedPost[]` |
| `src/x/messages.ts` | 取り込み係 → 橋渡し係のメッセージの形と検査 |
| `src/x/recent-cache.ts` | 直前に見た投稿を 500 件まで覚える |
| `src/x/hook-core.ts` | 取り込み係の判断（返事・ブクマ操作 → 送るメッセージ） |
| `src/x/network-patch.ts` | `fetch` と `XMLHttpRequest` を包む |
| `src/x/dom-read.ts` | X の画面（DOM）から投稿を読む（予備の手段）、ブクマボタンの判定 |
| `src/entrypoints/x-hook.content.ts` | 取り込み係の入口（MAIN world、document_start） |
| `src/core/health.ts` | 読み取りの調子（警告を出すかどうか） |
| `src/background/protocol.ts` | 橋渡し係 → 裏方の依頼の形 |
| `src/background/handlers.ts` | 裏方の依頼の処理（DB を引数で受け取る） |
| `src/background/badge.ts` | 拡張アイコンの件数表示 |
| `src/entrypoints/background.ts` | （変更）依頼の受付と件数表示の更新をつなぐ |
| `src/ui/picker/FolderPicker.tsx` / `picker.css` | フォルダ選択メニューと「N 件取り込み」表示の見た目 |
| `src/bridge/store.ts` | 橋渡し係の画面の状態と、メニューの位置の計算 |
| `src/bridge/BridgeApp.tsx` | 橋渡し係の画面（メニュー＋件数表示） |
| `src/bridge/bg-client.ts` | 裏方への依頼（再送・一時保留つき） |
| `src/entrypoints/x-bridge.content.tsx` | 橋渡し係の入口 |
| `README.md` / `docs/manual-test.md` | 開発中の読み込み手順と、手で確かめる表 |

---

### Task 1: 操作名と投稿 ID の扱い

**Files:**
- Create: `src/x/graphql.ts`, Test: `src/x/graphql.test.ts`

**Interfaces:**
- Produces: `graphqlOperation(url: string): string | null`、`isBookmarkListOp(op: string): boolean`、`type BookmarkMutation = "add" | "remove"`、`bookmarkMutation(op: string): BookmarkMutation | null`、`tweetIdFromBody(body: unknown): string | null`、`snowflakeToIso(id: string): string | null`

- [ ] **Step 1: 失敗するテストを書く**

`src/x/graphql.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bookmarkMutation, graphqlOperation, isBookmarkListOp, snowflakeToIso, tweetIdFromBody } from "./graphql";

describe("graphqlOperation", () => {
  it("絶対・相対どちらの URL からも操作名を取り出す", () => {
    expect(graphqlOperation("https://x.com/i/api/graphql/AbC-12_x/Bookmarks?variables=%7B%7D")).toBe("Bookmarks");
    expect(graphqlOperation("/i/api/graphql/q1/CreateBookmark")).toBe("CreateBookmark");
  });
  it("GraphQL 以外は null", () => {
    expect(graphqlOperation("https://x.com/home")).toBeNull();
    expect(graphqlOperation("https://abs.twimg.com/x.js")).toBeNull();
  });
});

describe("isBookmarkListOp", () => {
  it("ブクマ一覧の操作だけ true", () => {
    expect(isBookmarkListOp("Bookmarks")).toBe(true);
    expect(isBookmarkListOp("BookmarkSearchTimeline")).toBe(true);
    expect(isBookmarkListOp("BookmarkFolderTimeline")).toBe(true);
    expect(isBookmarkListOp("BookmarkFoldersSlice")).toBe(false);
    expect(isBookmarkListOp("HomeTimeline")).toBe(false);
    expect(isBookmarkListOp("CreateBookmark")).toBe(false);
  });
});

describe("bookmarkMutation", () => {
  it("追加と解除を見分ける", () => {
    expect(bookmarkMutation("CreateBookmark")).toBe("add");
    expect(bookmarkMutation("DeleteBookmark")).toBe("remove");
    expect(bookmarkMutation("FavoriteTweet")).toBeNull();
  });
});

describe("tweetIdFromBody", () => {
  it("文字列でもオブジェクトでも投稿 ID を取り出す", () => {
    expect(tweetIdFromBody('{"variables":{"tweet_id":"1973000000000000000"},"queryId":"q"}')).toBe("1973000000000000000");
    expect(tweetIdFromBody({ variables: { tweet_id: "123" } })).toBe("123");
  });
  it("取り出せなければ null", () => {
    expect(tweetIdFromBody("{壊れた")).toBeNull();
    expect(tweetIdFromBody({ variables: { tweet_id: 123 } })).toBeNull();
    expect(tweetIdFromBody({ variables: { tweet_id: "abc" } })).toBeNull();
    expect(tweetIdFromBody(undefined)).toBeNull();
  });
});

describe("snowflakeToIso", () => {
  it("投稿 ID から投稿日時を出す", () => {
    expect(snowflakeToIso("1973000000000000000")).toBe("2025-09-30T12:20:31.224Z");
  });
  it("古い形式の ID や数字でないものは null", () => {
    expect(snowflakeToIso("20")).toBeNull();
    expect(snowflakeToIso("abc")).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/x/graphql.test.ts`
Expected: FAIL（`./graphql` が見つからない）

- [ ] **Step 3: 実装する**

`src/x/graphql.ts`:

```ts
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
```

- [ ] **Step 4: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし

- [ ] **Step 5: Commit**

```bash
git add src/x/graphql.ts src/x/graphql.test.ts
git commit -m "取り込み: X の操作名・投稿 ID・投稿日時の扱い" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 読み取り係（X の返事 → 投稿）

**Files:**
- Create: `src/x/test-builders.ts`, `src/x/parse.ts`, Test: `src/x/parse.test.ts`

**Interfaces:**
- Consumes: `snowflakeToIso`（Task 1）、`domainOf`（計画1）、`CapturedPost`, `MediaItem`, `LinkItem`, `QuotedPost`（計画1）
- Produces（`parse.ts`）: `type ExtractMode = "bookmarks" | "cache"`、`type ExtractResult = { posts: CapturedPost[]; skipped: number }`、`extractPosts(json: unknown, mode: ExtractMode): ExtractResult`、`tweetToCaptured(tweet: unknown): CapturedPost | null`
- Produces（`test-builders.ts`）: `rawTweet(o: RawTweetOptions): Record<string, unknown>`、`visibilityWrapped(tweet: object): object`、`tombstone(): object`、`bookmarksResponse(entries: { tweet: object; sortIndex: string }[]): object`、`timelineResponse(tweets: object[]): object`

- [ ] **Step 1: テスト用の返事を作る関数を書く**

ここで作る JSON は X の返事の「形」だけを真似た架空のデータ。実際のアカウントや投稿のデータは使わない（公開リポジトリのため）。

`src/x/test-builders.ts`:

```ts
type RawMedia = {
  type: "photo" | "video" | "animated_gif";
  url: string;
  base: string;
  variants?: { bitrate?: number; content_type: string; url: string }[];
};

export type RawTweetOptions = {
  id: string;
  handle?: string;
  name?: string;
  text?: string;
  /** "core": 2025 年以降の形（core.screen_name・avatar.image_url）。"legacy": 古い形 */
  userLayout?: "core" | "legacy";
  urls?: { url: string; expanded: string }[];
  hashtags?: string[];
  media?: RawMedia[];
  note?: string;
  quoted?: object;
  retweeted?: object;
  createdAt?: string;
};

export function rawTweet(o: RawTweetOptions): Record<string, unknown> {
  const handle = o.handle ?? "alice";
  const name = o.name ?? "Alice";
  const avatar = `https://pbs.twimg.com/profile_images/${handle}.jpg`;
  const user =
    o.userLayout === "legacy"
      ? { __typename: "User", rest_id: `u-${handle}`, legacy: { screen_name: handle, name, profile_image_url_https: avatar } }
      : { __typename: "User", rest_id: `u-${handle}`, core: { screen_name: handle, name }, avatar: { image_url: avatar }, legacy: {} };
  const media = (o.media ?? []).map((m) => ({
    type: m.type,
    url: m.url,
    media_url_https: m.base,
    ...(m.variants ? { video_info: { variants: m.variants } } : {}),
  }));
  return {
    __typename: "Tweet",
    rest_id: o.id,
    core: { user_results: { result: user } },
    legacy: {
      full_text: o.text ?? "",
      created_at: o.createdAt ?? "Wed Oct 01 12:00:00 +0000 2025",
      entities: {
        hashtags: (o.hashtags ?? []).map((text) => ({ text })),
        urls: (o.urls ?? []).map((u) => ({ url: u.url, expanded_url: u.expanded })),
        ...(media.length ? { media } : {}),
      },
      ...(media.length ? { extended_entities: { media } } : {}),
      ...(o.retweeted ? { retweeted_status_result: { result: o.retweeted } } : {}),
    },
    ...(o.note ? { note_tweet: { note_tweet_results: { result: { text: o.note, entity_set: { urls: [], hashtags: [] } } } } } : {}),
    ...(o.quoted ? { quoted_status_result: { result: o.quoted } } : {}),
  };
}

export function visibilityWrapped(tweet: object): object {
  return { __typename: "TweetWithVisibilityResults", tweet };
}

export function tombstone(): object {
  return { __typename: "TweetTombstone", tombstone: { text: { text: "この投稿は表示できません" } } };
}

export function bookmarksResponse(entries: { tweet: object; sortIndex: string }[]): object {
  return {
    data: {
      bookmark_timeline_v2: {
        timeline: {
          instructions: [
            {
              type: "TimelineAddEntries",
              entries: [
                ...entries.map((e, i) => ({
                  entryId: `tweet-${i}`,
                  sortIndex: e.sortIndex,
                  content: {
                    entryType: "TimelineTimelineItem",
                    itemContent: { itemType: "TimelineTweet", tweet_results: { result: e.tweet } },
                  },
                })),
                { entryId: "cursor-bottom-0", sortIndex: "1", content: { entryType: "TimelineTimelineCursor", value: "c", cursorType: "Bottom" } },
              ],
            },
          ],
        },
      },
    },
  };
}

export function timelineResponse(tweets: object[]): object {
  return {
    data: {
      home: {
        home_timeline_urt: {
          instructions: [
            {
              type: "TimelineAddEntries",
              entries: tweets.map((t, i) => ({
                entryId: `tweet-${i}`,
                sortIndex: String(9000 - i),
                content: { itemContent: { tweet_results: { result: t } } },
              })),
            },
          ],
        },
      },
    },
  };
}
```

- [ ] **Step 2: 失敗するテストを書く**

`src/x/parse.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractPosts, tweetToCaptured } from "./parse";
import { bookmarksResponse, rawTweet, timelineResponse, tombstone, visibilityWrapped } from "./test-builders";

describe("tweetToCaptured", () => {
  it("本文の短縮 URL を元の URL に戻し、画像の URL は消し、&amp; などを戻す", () => {
    const p = tweetToCaptured(
      rawTweet({
        id: "1973000000000000000",
        handle: "alice",
        name: "アリス",
        text: "見て &amp; 読んで https://t.co/aaa https://t.co/img",
        urls: [{ url: "https://t.co/aaa", expanded: "https://www.youtube.com/watch?v=1" }],
        hashtags: ["推し活"],
        media: [{ type: "photo", url: "https://t.co/img", base: "https://pbs.twimg.com/media/P1.jpg" }],
      }),
    );
    expect(p).toEqual({
      id: "1973000000000000000",
      url: "https://x.com/alice/status/1973000000000000000",
      text: "見て & 読んで https://www.youtube.com/watch?v=1",
      author: { id: "u-alice", handle: "alice", name: "アリス", avatarUrl: "https://pbs.twimg.com/profile_images/alice.jpg" },
      postedAt: "2025-09-30T12:20:31.224Z",
      media: [{ type: "photo", url: "https://pbs.twimg.com/media/P1.jpg", thumbUrl: "https://pbs.twimg.com/media/P1.jpg?name=small" }],
      links: [{ url: "https://www.youtube.com/watch?v=1", domain: "youtube.com" }],
      hashtags: ["推し活"],
    });
  });

  it("古い形のユーザー情報も読める", () => {
    const p = tweetToCaptured(rawTweet({ id: "1973000000000000001", handle: "bob", name: "Bob", userLayout: "legacy" }));
    expect(p?.author).toEqual({ id: "u-bob", handle: "bob", name: "Bob", avatarUrl: "https://pbs.twimg.com/profile_images/bob.jpg" });
  });

  it("長文の投稿は note_tweet の本文を使う", () => {
    const p = tweetToCaptured(rawTweet({ id: "1973000000000000002", text: "途中まで…", note: "全文です" }));
    expect(p?.text).toBe("全文です");
  });

  it("動画は一番ビットレートの高い mp4 を URL にし、縮小画像は静止画", () => {
    const p = tweetToCaptured(
      rawTweet({
        id: "1973000000000000003",
        media: [
          {
            type: "video",
            url: "https://t.co/v",
            base: "https://pbs.twimg.com/ext_tw_video_thumb/V.jpg",
            variants: [
              { content_type: "application/x-mpegURL", url: "https://video.twimg.com/v.m3u8" },
              { bitrate: 256000, content_type: "video/mp4", url: "https://video.twimg.com/low.mp4" },
              { bitrate: 2176000, content_type: "video/mp4", url: "https://video.twimg.com/high.mp4" },
            ],
          },
          { type: "animated_gif", url: "https://t.co/g", base: "https://pbs.twimg.com/tweet_video_thumb/G.jpg", variants: [{ bitrate: 0, content_type: "video/mp4", url: "https://video.twimg.com/g.mp4" }] },
        ],
      }),
    );
    expect(p?.media).toEqual([
      { type: "video", url: "https://video.twimg.com/high.mp4", thumbUrl: "https://pbs.twimg.com/ext_tw_video_thumb/V.jpg" },
      { type: "gif", url: "https://video.twimg.com/g.mp4", thumbUrl: "https://pbs.twimg.com/tweet_video_thumb/G.jpg" },
    ]);
  });

  it("引用元は ID・投稿者・本文だけ持つ", () => {
    const quoted = rawTweet({ id: "1973000000000000010", handle: "carol", text: "元の投稿" });
    const p = tweetToCaptured(rawTweet({ id: "1973000000000000011", text: "引用します", quoted: visibilityWrapped(quoted) }));
    expect(p?.quoted).toEqual({ id: "1973000000000000010", authorHandle: "carol", text: "元の投稿" });
  });

  it("投稿 ID が古い形式なら created_at を使う", () => {
    const p = tweetToCaptured(rawTweet({ id: "20", createdAt: "Tue Mar 21 20:50:14 +0000 2006" }));
    expect(p?.postedAt).toBe("2006-03-21T20:50:14.000Z");
  });

  it("必要な項目が無ければ null", () => {
    expect(tweetToCaptured({ __typename: "Tweet", rest_id: "1" })).toBeNull();
    expect(tweetToCaptured("x")).toBeNull();
  });
});

describe("extractPosts（bookmarks）", () => {
  const a = rawTweet({ id: "1973000000000000100", text: "A" });
  const quoted = rawTweet({ id: "1973000000000000102", text: "引用元" });
  const b = visibilityWrapped(rawTweet({ id: "1973000000000000101", text: "B", quoted }));

  it("一覧の項目の投稿だけを、並び値つきで返す（引用元は返さない）", () => {
    const r = extractPosts(
      bookmarksResponse([
        { tweet: a, sortIndex: "1868000000000000002" },
        { tweet: b, sortIndex: "1868000000000000001" },
      ]),
      "bookmarks",
    );
    expect(r.skipped).toBe(0);
    expect(r.posts.map((p) => [p.id, p.bookmarkOrder])).toEqual([
      ["1973000000000000100", "1868000000000000002"],
      ["1973000000000000101", "1868000000000000001"],
    ]);
  });

  it("削除済み・閲覧不可の投稿は黙って飛ばす", () => {
    const r = extractPosts(bookmarksResponse([{ tweet: tombstone(), sortIndex: "5" }, { tweet: a, sortIndex: "4" }]), "bookmarks");
    expect(r).toMatchObject({ skipped: 0 });
    expect(r.posts.map((p) => p.id)).toEqual(["1973000000000000100"]);
  });

  it("読めない投稿は数える", () => {
    const r = extractPosts(bookmarksResponse([{ tweet: { __typename: "Tweet", rest_id: "1" }, sortIndex: "5" }]), "bookmarks");
    expect(r).toEqual({ posts: [], skipped: 1 });
  });
});

describe("extractPosts（cache）", () => {
  it("リポストの元投稿と引用元も返す。同じ投稿は 1 つにまとめる", () => {
    const original = rawTweet({ id: "1973000000000000200", handle: "dave", text: "元" });
    const repost = rawTweet({ id: "1973000000000000201", handle: "erin", text: "RT @dave: 元", retweeted: original });
    const quoting = rawTweet({ id: "1973000000000000202", text: "引用", quoted: original });
    const r = extractPosts(timelineResponse([repost, quoting]), "cache");
    expect(r.posts.map((p) => p.id).sort()).toEqual(["1973000000000000200", "1973000000000000201", "1973000000000000202"]);
    expect(r.posts.every((p) => p.bookmarkOrder === undefined)).toBe(true);
  });

  it("投稿の無い返事は空", () => {
    expect(extractPosts({ data: { user: { result: { legacy: {} } } } }, "cache")).toEqual({ posts: [], skipped: 0 });
    expect(extractPosts(null, "cache")).toEqual({ posts: [], skipped: 0 });
  });
});
```

- [ ] **Step 3: 失敗を確かめる**

Run: `npx vitest run src/x/parse.test.ts`
Expected: FAIL（`./parse` が見つからない）

- [ ] **Step 4: 実装する**

`src/x/parse.ts`:

```ts
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
```

- [ ] **Step 5: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし

- [ ] **Step 6: Commit**

```bash
git add src/x/test-builders.ts src/x/parse.ts src/x/parse.test.ts
git commit -m "取り込み: X の返事から投稿を読み取る" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: メッセージの形と、取り込み係の判断

**Files:**
- Create: `src/x/messages.ts`, `src/x/recent-cache.ts`, `src/x/hook-core.ts`
- Test: `src/x/messages.test.ts`, `src/x/recent-cache.test.ts`, `src/x/hook-core.test.ts`

**Interfaces:**
- Consumes: `extractPosts`, `ExtractResult`（Task 2）、`isBookmarkListOp`, `bookmarkMutation`, `tweetIdFromBody`（Task 1）、`CapturedPost`（計画1）
- Produces（`messages.ts`）: `HOOK_SOURCE = "twittana-hook"`、`MAX_POSTS_PER_MESSAGE = 500`、`type HookMessage`（4 種: `bookmarks-seen` / `bookmark-added` / `bookmark-removed` / `parse-error`）、`isCapturedPost(v: unknown): v is CapturedPost`、`isHookMessage(v: unknown): v is HookMessage`
- Produces（`recent-cache.ts`）: `class RecentPosts { constructor(limit?: number); add(posts: CapturedPost[]): void; get(id: string): CapturedPost | undefined; readonly size: number }`
- Produces（`hook-core.ts`）: `type HookCore = { onResponse(op: string, json: unknown): HookMessage[]; onMutation(op: string, requestBody: unknown): HookMessage[] }`、`createHookCore(cache?: RecentPosts): HookCore`

- [ ] **Step 1: 失敗するテストを書く**

`src/x/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeCaptured } from "../test/factories";
import { HOOK_SOURCE, isCapturedPost, isHookMessage, MAX_POSTS_PER_MESSAGE } from "./messages";

describe("isCapturedPost", () => {
  it("正しい形なら true", () => {
    expect(isCapturedPost(makeCaptured())).toBe(true);
    expect(isCapturedPost(makeCaptured({ quoted: { id: "1", authorHandle: "a", text: "t" }, bookmarkOrder: "5", partial: true }))).toBe(true);
  });
  it("形が違えば false", () => {
    expect(isCapturedPost({ ...makeCaptured(), id: "abc" })).toBe(false);
    expect(isCapturedPost({ ...makeCaptured(), url: "https://evil.example/1" })).toBe(false);
    expect(isCapturedPost({ ...makeCaptured(), media: [{ type: "audio", url: "u", thumbUrl: "t" }] })).toBe(false);
    expect(isCapturedPost({ ...makeCaptured(), text: "あ".repeat(20001) })).toBe(false);
    expect(isCapturedPost(null)).toBe(false);
  });
});

describe("isHookMessage", () => {
  it("4 種類のメッセージを受け付ける", () => {
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmarks-seen", posts: [makeCaptured()] })).toBe(true);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmark-added", postId: "1", post: null })).toBe(true);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmark-added", postId: "1", post: makeCaptured({ id: "1" }) })).toBe(true);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmark-removed", postId: "1" })).toBe(true);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "parse-error", op: "Bookmarks" })).toBe(true);
  });
  it("差出人・種類・中身・件数が違えば捨てる", () => {
    expect(isHookMessage({ source: "other", type: "parse-error", op: "x" })).toBe(false);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "delete-all" })).toBe(false);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmark-removed", postId: "../1" })).toBe(false);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmarks-seen", posts: [{ id: "1" }] })).toBe(false);
    const tooMany = Array.from({ length: MAX_POSTS_PER_MESSAGE + 1 }, (_, i) => makeCaptured({ id: String(i + 1) }));
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmarks-seen", posts: tooMany })).toBe(false);
  });
});
```

`src/x/recent-cache.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeCaptured } from "../test/factories";
import { RecentPosts } from "./recent-cache";

describe("RecentPosts", () => {
  it("上限を超えたら古いものから捨てる。見直したものは新しくなる", () => {
    const c = new RecentPosts(2);
    c.add([makeCaptured({ id: "1" }), makeCaptured({ id: "2" })]);
    c.add([makeCaptured({ id: "1", text: "更新" })]);
    c.add([makeCaptured({ id: "3" })]);
    expect(c.size).toBe(2);
    expect(c.get("2")).toBeUndefined();
    expect(c.get("1")?.text).toBe("更新");
    expect(c.get("3")).toBeDefined();
  });
});
```

`src/x/hook-core.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createHookCore } from "./hook-core";
import { HOOK_SOURCE } from "./messages";
import { bookmarksResponse, rawTweet, timelineResponse } from "./test-builders";

const ID = "1973000000000000300";
const body = (id: string) => JSON.stringify({ variables: { tweet_id: id }, queryId: "q" });

describe("createHookCore", () => {
  it("ブクマ一覧の返事は bookmarks-seen にする", () => {
    const core = createHookCore();
    const msgs = core.onResponse("Bookmarks", bookmarksResponse([{ tweet: rawTweet({ id: ID }), sortIndex: "9" }]));
    expect(msgs).toMatchObject([{ source: HOOK_SOURCE, type: "bookmarks-seen", posts: [{ id: ID, bookmarkOrder: "9" }] }]);
    expect(msgs).toHaveLength(1);
  });

  it("タイムラインの返事は覚えるだけで、ブクマしたときに中身つきで知らせる", () => {
    const core = createHookCore();
    expect(core.onResponse("HomeTimeline", timelineResponse([rawTweet({ id: ID, text: "覚えた" })]))).toEqual([]);
    expect(core.onMutation("CreateBookmark", body(ID))).toMatchObject([
      { source: HOOK_SOURCE, type: "bookmark-added", postId: ID, post: { id: ID, text: "覚えた" } },
    ]);
  });

  it("覚えていない投稿のブクマは post: null で知らせる", () => {
    expect(createHookCore().onMutation("CreateBookmark", body(ID))).toEqual([{ source: HOOK_SOURCE, type: "bookmark-added", postId: ID, post: null }]);
  });

  it("ブクマ解除を知らせる", () => {
    expect(createHookCore().onMutation("DeleteBookmark", body(ID))).toEqual([{ source: HOOK_SOURCE, type: "bookmark-removed", postId: ID }]);
  });

  it("ブクマ以外の操作は何もしない", () => {
    expect(createHookCore().onMutation("FavoriteTweet", body(ID))).toEqual([]);
  });

  it("送信本文から投稿 ID が読めなければ parse-error", () => {
    expect(createHookCore().onMutation("CreateBookmark", "{}")).toEqual([{ source: HOOK_SOURCE, type: "parse-error", op: "CreateBookmark" }]);
  });

  it("ブクマ一覧で読めない投稿があれば parse-error も出す", () => {
    const msgs = createHookCore().onResponse("Bookmarks", bookmarksResponse([{ tweet: { __typename: "Tweet", rest_id: "1" }, sortIndex: "9" }]));
    expect(msgs).toEqual([{ source: HOOK_SOURCE, type: "parse-error", op: "Bookmarks" }]);
  });

  it("件数が多ければ分けて送る", () => {
    const entries = Array.from({ length: 501 }, (_, i) => ({ tweet: rawTweet({ id: String(1973000000000000000n + BigInt(i)) }), sortIndex: String(i + 1) }));
    const msgs = createHookCore().onResponse("Bookmarks", bookmarksResponse(entries));
    expect(msgs.map((m) => (m.type === "bookmarks-seen" ? m.posts.length : 0))).toEqual([500, 1]);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/x/messages.test.ts src/x/recent-cache.test.ts src/x/hook-core.test.ts`
Expected: FAIL（モジュールが見つからない）

- [ ] **Step 3: 実装する**

`src/x/messages.ts`:

```ts
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
```

`src/x/recent-cache.ts`:

```ts
import type { CapturedPost } from "../core/types";

/** 直前に画面に流れてきた投稿を覚えておく（古いものから捨てる） */
export class RecentPosts {
  private readonly map = new Map<string, CapturedPost>();

  constructor(private readonly limit = 500) {}

  add(posts: CapturedPost[]): void {
    for (const p of posts) {
      this.map.delete(p.id);
      this.map.set(p.id, p);
    }
    while (this.map.size > this.limit) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  get(id: string): CapturedPost | undefined {
    return this.map.get(id);
  }

  get size(): number {
    return this.map.size;
  }
}
```

`src/x/hook-core.ts`:

```ts
import { bookmarkMutation, isBookmarkListOp, tweetIdFromBody } from "./graphql";
import { HOOK_SOURCE, MAX_POSTS_PER_MESSAGE, type HookMessage } from "./messages";
import { extractPosts, type ExtractResult } from "./parse";
import { RecentPosts } from "./recent-cache";

export type HookCore = {
  /** GraphQL の返事（成功したもの）を受け取り、橋渡し係へ送るメッセージを返す */
  onResponse(op: string, json: unknown): HookMessage[];
  /** ブクマ操作（成功したもの）の送信本文を受け取り、送るメッセージを返す */
  onMutation(op: string, requestBody: unknown): HookMessage[];
};

export function createHookCore(cache: RecentPosts = new RecentPosts()): HookCore {
  return {
    onResponse(op, json) {
      if (bookmarkMutation(op)) return [];
      const bookmarkList = isBookmarkListOp(op);
      let result: ExtractResult;
      try {
        result = extractPosts(json, bookmarkList ? "bookmarks" : "cache");
      } catch {
        return [{ source: HOOK_SOURCE, type: "parse-error", op }];
      }
      cache.add(result.posts);
      const out: HookMessage[] = [];
      if (result.skipped > 0 && (bookmarkList || result.posts.length === 0)) {
        out.push({ source: HOOK_SOURCE, type: "parse-error", op });
      }
      if (bookmarkList) {
        for (let i = 0; i < result.posts.length; i += MAX_POSTS_PER_MESSAGE) {
          out.push({ source: HOOK_SOURCE, type: "bookmarks-seen", posts: result.posts.slice(i, i + MAX_POSTS_PER_MESSAGE) });
        }
      }
      return out;
    },

    onMutation(op, requestBody) {
      const kind = bookmarkMutation(op);
      if (!kind) return [];
      const postId = tweetIdFromBody(requestBody);
      if (!postId) return [{ source: HOOK_SOURCE, type: "parse-error", op }];
      if (kind === "remove") return [{ source: HOOK_SOURCE, type: "bookmark-removed", postId }];
      return [{ source: HOOK_SOURCE, type: "bookmark-added", postId, post: cache.get(postId) ?? null }];
    },
  };
}
```

- [ ] **Step 4: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし

- [ ] **Step 5: Commit**

```bash
git add src/x/messages.ts src/x/messages.test.ts src/x/recent-cache.ts src/x/recent-cache.test.ts src/x/hook-core.ts src/x/hook-core.test.ts
git commit -m "取り込み: メッセージの形と取り込み係の判断" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 通信を包む部分と取り込み係の入口

**Files:**
- Create: `src/x/network-patch.ts`, Test: `src/x/network-patch.test.ts`
- Create: `src/entrypoints/x-hook.content.ts`

**Interfaces:**
- Consumes: `graphqlOperation`, `bookmarkMutation`（Task 1）、`createHookCore`、`HOOK_SOURCE`, `HookMessage`（Task 3）
- Produces: `type NetworkHandler = (url: string, requestBody: unknown, ok: boolean, readJson: () => Promise<unknown>) => void`、`patchFetch(target: { fetch: typeof fetch }, handle: NetworkHandler): void`、`patchXhr(target: { XMLHttpRequest: typeof XMLHttpRequest }, handle: NetworkHandler, shouldWatch: (url: string) => boolean): void`

- [ ] **Step 1: 失敗するテストを書く**

`src/x/network-patch.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { patchFetch } from "./network-patch";

const tick = () => new Promise((r) => setTimeout(r, 0));

function fakeTarget(body: string, status = 200) {
  return { fetch: (async () => new Response(body, { status, headers: { "content-type": "application/json" } })) as typeof fetch };
}

describe("patchFetch", () => {
  it("返事はそのまま返し、URL・送信本文・成否・JSON を知らせる", async () => {
    const target = fakeTarget('{"a":1}');
    const seen: unknown[] = [];
    patchFetch(target, (url, body, ok, readJson) => {
      void readJson().then((json) => seen.push({ url, body, ok, json }));
    });
    const res = await target.fetch("https://x.com/i/api/graphql/q/Bookmarks?v=1", { method: "POST", body: "{}" });
    expect(await res.json()).toEqual({ a: 1 });
    await tick();
    expect(seen).toEqual([{ url: "https://x.com/i/api/graphql/q/Bookmarks?v=1", body: "{}", ok: true, json: { a: 1 } }]);
  });

  it("URL オブジェクトと Request も受け付け、失敗の返事は ok: false で知らせる", async () => {
    const target = fakeTarget("{}", 500);
    const urls: [string, boolean][] = [];
    patchFetch(target, (url, _body, ok) => urls.push([url, ok]));
    await target.fetch(new URL("https://x.com/a"));
    await target.fetch(new Request("https://x.com/b"));
    expect(urls).toEqual([
      ["https://x.com/a", false],
      ["https://x.com/b", false],
    ]);
  });

  it("知らせる側が例外を投げても、返事はそのまま返る", async () => {
    const target = fakeTarget('{"ok":true}');
    patchFetch(target, () => {
      throw new Error("壊れた");
    });
    const res = await target.fetch("https://x.com/i/api/graphql/q/Bookmarks");
    expect(await res.json()).toEqual({ ok: true });
  });

  it("JSON でない返事でも、返事はそのまま返る", async () => {
    const target = fakeTarget("<html>");
    let failed = false;
    patchFetch(target, (_u, _b, _ok, readJson) => {
      readJson().catch(() => {
        failed = true;
      });
    });
    const res = await target.fetch("https://x.com/i/api/graphql/q/Bookmarks");
    expect(await res.text()).toBe("<html>");
    await tick();
    expect(failed).toBe(true);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/x/network-patch.test.ts`
Expected: FAIL（`./network-patch` が見つからない）

- [ ] **Step 3: 実装する**

`src/x/network-patch.ts`:

```ts
/**
 * 通信を受け取ったときに呼ぶ関数。
 * readJson は呼ばれたその場で返事を複製するので、handle の中で同期的に呼ぶこと。
 */
export type NetworkHandler = (url: string, requestBody: unknown, ok: boolean, readJson: () => Promise<unknown>) => void;

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** fetch を包む。X の画面に渡す返事には手を加えない */
export function patchFetch(target: { fetch: typeof fetch }, handle: NetworkHandler): void {
  const original = target.fetch;
  target.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const res = await original.call(target, input, init);
    try {
      const copy = res.clone();
      handle(urlOf(input), init?.body, res.ok, () => copy.json());
    } catch {
      // X の画面は壊さない
    }
    return res;
  };
}

/** XMLHttpRequest を包む。shouldWatch が true の URL だけ見る */
export function patchXhr(
  target: { XMLHttpRequest: typeof XMLHttpRequest },
  handle: NetworkHandler,
  shouldWatch: (url: string) => boolean,
): void {
  const proto = target.XMLHttpRequest.prototype;
  const originalOpen = proto.open;
  const originalSend = proto.send;
  const urls = new WeakMap<XMLHttpRequest, string>();

  proto.open = function patchedOpen(this: XMLHttpRequest, ...args: unknown[]) {
    try {
      urls.set(this, String(args[1]));
    } catch {
      // X の画面は壊さない
    }
    return (originalOpen as (...a: unknown[]) => void).apply(this, args);
  } as typeof proto.open;

  proto.send = function patchedSend(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    const url = urls.get(this);
    if (url && shouldWatch(url)) {
      this.addEventListener("load", () => {
        try {
          const ok = this.status >= 200 && this.status < 300;
          handle(url, body, ok, async () => {
            if (this.responseType === "json") return this.response;
            if (this.responseType === "" || this.responseType === "text") return JSON.parse(this.responseText);
            throw new Error(`unsupported responseType: ${this.responseType}`);
          });
        } catch {
          // X の画面は壊さない
        }
      });
    }
    return originalSend.call(this, body);
  };
}
```

- [ ] **Step 4: 取り込み係の入口を書く**

`src/entrypoints/x-hook.content.ts`:

```ts
import { defineContentScript } from "#imports";
import { bookmarkMutation, graphqlOperation } from "../x/graphql";
import { createHookCore } from "../x/hook-core";
import { HOOK_SOURCE, type HookMessage } from "../x/messages";
import { patchFetch, patchXhr, type NetworkHandler } from "../x/network-patch";

/**
 * 取り込み係（MAIN world）。X の画面が受け取った GraphQL の返事を横で読み、
 * 橋渡し係へ window.postMessage で渡す。拡張 API は使えない。
 */
export default defineContentScript({
  matches: ["https://x.com/*"],
  world: "MAIN",
  runAt: "document_start",
  main() {
    const core = createHookCore();
    const post = (messages: HookMessage[]) => {
      for (const m of messages) window.postMessage(m, window.location.origin);
    };

    const handle: NetworkHandler = (url, requestBody, ok, readJson) => {
      const op = graphqlOperation(url);
      if (!op || !ok) return;
      if (bookmarkMutation(op)) {
        post(core.onMutation(op, requestBody));
        return;
      }
      readJson().then(
        (json) => post(core.onResponse(op, json)),
        () => post([{ source: HOOK_SOURCE, type: "parse-error", op }]),
      );
    };

    patchFetch(window, handle);
    patchXhr(window, handle, (url) => graphqlOperation(url) !== null);
  },
});
```

- [ ] **Step 5: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし
Run: `npm run build` → 成功。`.output/chrome-mv3/manifest.json` の `content_scripts` に `"world": "MAIN"`、`"run_at": "document_start"`、`"matches": ["https://x.com/*"]` の項目がある

- [ ] **Step 6: Commit**

```bash
git add src/x/network-patch.ts src/x/network-patch.test.ts src/entrypoints/x-hook.content.ts
git commit -m "取り込み: 通信を包む部分と取り込み係の入口" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 裏方の依頼処理と件数表示

**Files:**
- Create: `src/core/health.ts`, Test: `src/core/health.test.ts`
- Create: `src/background/protocol.ts`, `src/background/handlers.ts`, `src/background/badge.ts`
- Test: `src/background/handlers.test.ts`
- Modify: `src/entrypoints/background.ts`

**Interfaces:**
- Consumes: 計画1の DB 関数（冒頭の「前提」参照）
- Produces（`health.ts`）: `hasParseWarning(h: ParseHealth): boolean`
- Produces（`protocol.ts`）: `type BgRequest`（8 種）、`type PickerState = { enabled: boolean; folders: Folder[]; selected: string[] }`、`type BgResponseMap`、`isBgRequest(v: unknown): v is BgRequest`
- Produces（`handlers.ts`）: `handleRequest(db: TwitTanaDB, req: BgRequest, now: string): Promise<BgResponseMap[BgRequest["type"]]>`
- Produces（`badge.ts`）: `refreshBadge(): Promise<void>`

- [ ] **Step 1: 失敗するテストを書く**

`src/core/health.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hasParseWarning } from "./health";

describe("hasParseWarning", () => {
  it("最後の失敗が最後の成功より新しいときだけ警告", () => {
    expect(hasParseWarning({})).toBe(false);
    expect(hasParseWarning({ lastErrorAt: "2026-10-02T00:00:00.000Z" })).toBe(true);
    expect(hasParseWarning({ lastOkAt: "2026-10-02T01:00:00.000Z", lastErrorAt: "2026-10-02T00:00:00.000Z" })).toBe(false);
    expect(hasParseWarning({ lastOkAt: "2026-10-02T00:00:00.000Z", lastErrorAt: "2026-10-02T01:00:00.000Z" })).toBe(true);
  });
});
```

`src/background/handlers.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { createFolder } from "../db/folders";
import { getSettings, updateSettings } from "../db/settings";
import { makeCaptured, makePost } from "../test/factories";
import { openTestDb } from "../test/db";
import { handleRequest } from "./handlers";
import { isBgRequest } from "./protocol";

const NOW = "2026-10-02T00:00:00.000Z";
const db = openTestDb();
afterEach(async () => {
  await Promise.all([db.posts.clear(), db.folders.clear(), db.rules.clear(), db.kv.clear()]);
});

describe("isBgRequest", () => {
  it("知っている種類だけ受け付ける", () => {
    expect(isBgRequest({ type: "get-stats" })).toBe(true);
    expect(isBgRequest({ type: "drop-database" })).toBe(false);
    expect(isBgRequest("get-stats")).toBe(false);
  });
});

describe("handleRequest", () => {
  it("save-posts: ブクマとして保存し、全件数と成功日時を記録する", async () => {
    const res = await handleRequest(db, { type: "save-posts", posts: [makeCaptured({ id: "1" }), makeCaptured({ id: "2" })] }, NOW);
    expect(res).toEqual({ saved: 2, total: 2 });
    expect((await getSettings(db)).parseHealth.lastOkAt).toBe(NOW);
  });

  it("mark-removed: 解除済みの印をつける", async () => {
    await db.posts.put(makePost({ id: "1" }));
    expect(await handleRequest(db, { type: "mark-removed", postId: "1" }, NOW)).toEqual({ ok: true });
    expect((await db.posts.get("1"))?.removedOnX).toBe(true);
  });

  it("report-parse-error: 失敗日時と操作名を記録する", async () => {
    await handleRequest(db, { type: "report-parse-error", op: "Bookmarks" }, NOW);
    expect((await getSettings(db)).parseHealth).toEqual({ lastErrorAt: NOW, lastErrorOp: "Bookmarks" });
  });

  it("get-picker-state: 設定・フォルダ・その投稿の入っているフォルダ", async () => {
    const f = await createFolder(db, { name: "A" }, NOW);
    await db.posts.put(makePost({ id: "1", folders: [{ folderId: f.id, by: "rule" }] }));
    await updateSettings(db, { pickerOnBookmark: false });
    expect(await handleRequest(db, { type: "get-picker-state", postId: "1" }, NOW)).toEqual({ enabled: false, folders: [f], selected: [f.id] });
  });

  it("set-folder: 手で出し入れし、入っているフォルダを返す", async () => {
    const f = await createFolder(db, { name: "A" }, NOW);
    await db.posts.put(makePost({ id: "1" }));
    expect(await handleRequest(db, { type: "set-folder", postId: "1", folderId: f.id, on: true }, NOW)).toEqual({ selected: [f.id] });
    expect(await handleRequest(db, { type: "set-folder", postId: "1", folderId: f.id, on: false }, NOW)).toEqual({ selected: [] });
    expect((await db.posts.get("1"))?.sortedByUser).toBe(true);
  });

  it("create-folder: 作って投稿を入れる。名前が重なれば理由を返す", async () => {
    await db.posts.put(makePost({ id: "1" }));
    const res = await handleRequest(db, { type: "create-folder", name: "新しい", postId: "1" }, NOW);
    expect(res).toMatchObject({ ok: true, folder: { name: "新しい" } });
    const id = res && "folder" in res ? res.folder.id : "";
    expect(res).toMatchObject({ selected: [id] });
    expect(await handleRequest(db, { type: "create-folder", name: "新しい" }, NOW)).toEqual({ ok: false, error: "duplicate" });
    expect(await handleRequest(db, { type: "create-folder", name: " " }, NOW)).toEqual({ ok: false, error: "empty" });
  });

  it("get-stats: 全件数と読み取りの調子", async () => {
    await db.posts.bulkPut([makePost({ id: "1" }), makePost({ id: "2" })]);
    expect(await handleRequest(db, { type: "get-stats" }, NOW)).toEqual({ total: 2, health: {} });
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/core/health.test.ts src/background/handlers.test.ts`
Expected: FAIL（モジュールが見つからない）

- [ ] **Step 3: 実装する**

`src/core/health.ts`:

```ts
import type { ParseHealth } from "./types";

/** X の仕様変更で読み取れていないかもしれない（最後の失敗が最後の成功より新しい） */
export function hasParseWarning(h: ParseHealth): boolean {
  if (!h.lastErrorAt) return false;
  return !h.lastOkAt || h.lastErrorAt > h.lastOkAt;
}
```

`src/background/protocol.ts`:

```ts
import type { CapturedPost, Folder, ParseHealth } from "../core/types";

/** 橋渡し係（x.com のページ内）から裏方への依頼 */
export type BgRequest =
  | { type: "save-posts"; posts: CapturedPost[] }
  | { type: "mark-removed"; postId: string }
  | { type: "report-parse-error"; op: string }
  | { type: "get-picker-state"; postId: string }
  | { type: "set-folder"; postId: string; folderId: string; on: boolean }
  | { type: "create-folder"; name: string; postId?: string }
  | { type: "get-stats" }
  | { type: "refresh-badge" };

export type PickerState = { enabled: boolean; folders: Folder[]; selected: string[] };

export type BgResponseMap = {
  "save-posts": { saved: number; total: number };
  "mark-removed": { ok: true };
  "report-parse-error": { ok: true };
  "get-picker-state": PickerState;
  "set-folder": { selected: string[] };
  "create-folder": { ok: true; folder: Folder; selected: string[] } | { ok: false; error: "empty" | "duplicate" };
  "get-stats": { total: number; health: ParseHealth };
  "refresh-badge": { ok: true };
};

const TYPES = new Set<string>([
  "save-posts",
  "mark-removed",
  "report-parse-error",
  "get-picker-state",
  "set-folder",
  "create-folder",
  "get-stats",
  "refresh-badge",
]);

export function isBgRequest(v: unknown): v is BgRequest {
  return typeof v === "object" && v !== null && TYPES.has((v as { type?: unknown }).type as string);
}
```

`src/background/handlers.ts`:

```ts
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
      return { enabled: settings.pickerOnBookmark, folders, selected };
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
    case "get-stats":
      return { total: await db.posts.count(), health: (await getSettings(db)).parseHealth };
    case "refresh-badge":
      return { ok: true };
  }
}
```

`src/background/badge.ts`:

```ts
import { browser } from "#imports";
import { localDateString } from "../core/review";
import { remainingReviewCount } from "../db/review-repo";
import { getDb } from "../db/schema";

/** 拡張アイコンに「今日の積みツイ崩し」の残り件数を出す（0 なら消す） */
export async function refreshBadge(): Promise<void> {
  const n = await remainingReviewCount(getDb(), localDateString(new Date()));
  await browser.action.setBadgeBackgroundColor({ color: "#7c5a3a" });
  await browser.action.setBadgeText({ text: n > 0 ? String(n) : "" });
}
```

`src/entrypoints/background.ts` を次の内容に置き換える（`openDashboard` は計画1のまま）:

```ts
import { browser, defineBackground } from "#imports";
import { refreshBadge } from "../background/badge";
import { handleRequest } from "../background/handlers";
import { isBgRequest, type BgRequest } from "../background/protocol";
import { getDb } from "../db/schema";

const DASHBOARD_PATH = "/dashboard.html";
const BADGE_AFFECTING = new Set<BgRequest["type"]>(["save-posts", "refresh-badge"]);

/** 本棚画面を開く。既に開いているタブがあればそこへ移る */
async function openDashboard(): Promise<void> {
  const url = browser.runtime.getURL(DASHBOARD_PATH);
  const contexts = await browser.runtime.getContexts({
    contextTypes: [browser.runtime.ContextType.TAB],
    documentUrls: [url],
  });
  const found = contexts[0];
  if (found && found.tabId !== -1) {
    await browser.tabs.update(found.tabId, { active: true });
    if (found.windowId !== -1) await browser.windows.update(found.windowId, { focused: true });
    return;
  }
  await browser.tabs.create({ url });
}

function updateBadgeQuietly(): void {
  refreshBadge().catch(() => {
    // 件数表示の失敗は致命的ではない
  });
}

export default defineBackground(() => {
  browser.action.onClicked.addListener(() => {
    void openDashboard();
  });

  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isBgRequest(message)) return false;
    handleRequest(getDb(), message, new Date().toISOString())
      .then((res) => {
        sendResponse(res);
        if (BADGE_AFFECTING.has(message.type)) updateBadgeQuietly();
      })
      .catch((e: unknown) => sendResponse({ error: e instanceof Error ? e.message : String(e) }));
    return true; // 非同期で返事をする
  });

  browser.runtime.onStartup.addListener(updateBadgeQuietly);
  browser.runtime.onInstalled.addListener(updateBadgeQuietly);
  updateBadgeQuietly();
});
```

（計画1の Task 1 で `browser.runtime.ContextType` を別の書き方に置き換えていた場合は、その書き方を保つ）

- [ ] **Step 4: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし / `npm run build` → 成功

- [ ] **Step 5: Commit**

```bash
git add src/core/health.ts src/core/health.test.ts src/background src/entrypoints/background.ts
git commit -m "取り込み: 裏方の依頼処理とアイコンの件数表示" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 画面（DOM）から読む予備の手段

**Files:**
- Create: `src/x/dom-read.ts`, Test: `src/x/dom-read.test.ts`

**Interfaces:**
- Consumes: `snowflakeToIso`（Task 1）、`CapturedPost`（計画1）
- Produces: `findBookmarkButton(target: EventTarget | null): Element | null`、`postIdFromArticle(article: Element): string | null`、`partialPost(postId: string): CapturedPost`、`readPostFromArticle(article: Element, postId: string): CapturedPost`

- [ ] **Step 1: 開発用の依存を入れる**

Run: `npm install -D happy-dom`

- [ ] **Step 2: 失敗するテストを書く**

`src/x/dom-read.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { findBookmarkButton, partialPost, postIdFromArticle, readPostFromArticle } from "./dom-read";

const ID = "1973000000000000400";

function article(index: number): Element {
  const found = document.querySelectorAll("article")[index];
  if (!found) throw new Error(`article ${index} が無い`);
  return found;
}

beforeEach(() => {
  document.body.innerHTML = `
    <article data-testid="tweet">
      <div data-testid="Tweet-User-Avatar"><img src="https://pbs.twimg.com/profile_images/a.jpg"></div>
      <div data-testid="User-Name"><a href="/alice"><span>アリス</span></a><a href="/alice/status/${ID}"><time datetime="2026-09-01T10:00:00.000Z">9月1日</time></a></div>
      <div data-testid="tweetText"><span>すごい</span> <a href="/hashtag/推し活">#推し活</a></div>
      <img src="https://pbs.twimg.com/media/P1?format=jpg&name=small">
      <div role="group"><button data-testid="bookmark"><svg><path></path></svg></button></div>
      <div class="quoted"><a href="/carol/status/1973000000000000399">引用</a></div>
    </article>
    <article data-testid="tweet"><div>ID の分からない投稿</div></article>`;
});

describe("findBookmarkButton", () => {
  it("ブクマボタンの中の要素からボタンを見つける", () => {
    const path = document.querySelector("path");
    expect(findBookmarkButton(path)?.getAttribute("data-testid")).toBe("bookmark");
    expect(findBookmarkButton(document.querySelector("time"))).toBeNull();
    expect(findBookmarkButton(null)).toBeNull();
  });
});

describe("postIdFromArticle", () => {
  it("日時のリンクから投稿 ID を取る（引用元の ID ではなく）", () => {
    expect(postIdFromArticle(article(0))).toBe(ID);
    expect(postIdFromArticle(article(1))).toBeNull();
  });
});

describe("readPostFromArticle", () => {
  it("画面に出ている範囲で投稿を読む", () => {
    expect(readPostFromArticle(article(0), ID)).toEqual({
      id: ID,
      url: `https://x.com/alice/status/${ID}`,
      text: "すごい #推し活",
      author: { id: "", handle: "alice", name: "アリス", avatarUrl: "https://pbs.twimg.com/profile_images/a.jpg" },
      postedAt: "2026-09-01T10:00:00.000Z",
      media: [{ type: "photo", url: "https://pbs.twimg.com/media/P1?format=jpg&name=small", thumbUrl: "https://pbs.twimg.com/media/P1?format=jpg&name=small" }],
      links: [],
      hashtags: ["推し活"],
    });
  });
  it("読めなければ ID と URL だけの投稿にする", () => {
    expect(readPostFromArticle(article(1), ID)).toEqual(partialPost(ID));
  });
});

describe("partialPost", () => {
  it("ID と URL と、ID から分かる投稿日時だけ", () => {
    expect(partialPost(ID)).toEqual({
      id: ID,
      url: `https://x.com/i/status/${ID}`,
      text: "",
      author: { id: "", handle: "", name: "", avatarUrl: "" },
      postedAt: "2025-09-30T12:20:31.224Z",
      media: [],
      links: [],
      hashtags: [],
      partial: true,
    });
  });
});
```

（`partialPost(ID)` の `postedAt` は ID `1973000000000000400` から出る値。もし `2025-09-30T12:20:31.224Z` と違えば、`node -e "console.log(new Date(Number((BigInt('1973000000000000400')>>22n)+1288834974657n)).toISOString())"` の結果に合わせる）

- [ ] **Step 3: 失敗を確かめる**

Run: `npx vitest run src/x/dom-read.test.ts`
Expected: FAIL（`./dom-read` が見つからない）

- [ ] **Step 4: 実装する**

`src/x/dom-read.ts`:

```ts
import type { CapturedPost, MediaItem } from "../core/types";
import { snowflakeToIso } from "./graphql";

const BOOKMARK_BUTTON = '[data-testid="bookmark"], [data-testid="removeBookmark"]';

/** クリックされた要素がブクマボタン（またはその中）なら、ボタンを返す */
export function findBookmarkButton(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest(BOOKMARK_BUTTON) : null;
}

/** 投稿の枠（article）から、その投稿の ID を取る。日時のリンクを使うので引用元と取り違えない */
export function postIdFromArticle(article: Element): string | null {
  const href = article.querySelector('a[href*="/status/"] time')?.closest("a")?.getAttribute("href");
  return (href ? /\/status\/(\d+)/.exec(href)?.[1] : undefined) ?? null;
}

/** ID と URL しか分からない投稿（中身はあとでブクマ画面から埋まる） */
export function partialPost(postId: string): CapturedPost {
  return {
    id: postId,
    url: `https://x.com/i/status/${postId}`,
    text: "",
    author: { id: "", handle: "", name: "", avatarUrl: "" },
    postedAt: snowflakeToIso(postId) ?? "",
    media: [],
    links: [],
    hashtags: [],
    partial: true,
  };
}

/** 画面に出ている投稿の枠から、読める範囲で投稿を読む（通信データが無いときの予備） */
export function readPostFromArticle(article: Element, postId: string): CapturedPost {
  const handle = article.querySelector(`a[href*="/status/${postId}"]`)?.getAttribute("href")?.split("/")[1] ?? "";
  if (!handle || handle === "i") return partialPost(postId);
  const textEl = article.querySelector('[data-testid="tweetText"]');
  const time = article.querySelector("time")?.getAttribute("datetime");
  const postedAt = time && !Number.isNaN(Date.parse(time)) ? new Date(time).toISOString() : (snowflakeToIso(postId) ?? "");
  const hashtags = [...(textEl?.querySelectorAll('a[href^="/hashtag/"]') ?? [])]
    .map((a) => (a.textContent ?? "").replace(/^[#＃]/, ""))
    .filter((h) => h !== "");
  const media: MediaItem[] = [...article.querySelectorAll('img[src*="pbs.twimg.com/media/"]')].map((img) => {
    const src = img.getAttribute("src") ?? "";
    return { type: "photo", url: src, thumbUrl: src };
  });
  return {
    id: postId,
    url: `https://x.com/${handle}/status/${postId}`,
    text: (textEl?.textContent ?? "").trim(),
    author: {
      id: "",
      handle,
      name: article.querySelector('[data-testid="User-Name"] span')?.textContent?.trim() || handle,
      avatarUrl: article.querySelector('[data-testid="Tweet-User-Avatar"] img')?.getAttribute("src") ?? "",
    },
    postedAt,
    media,
    links: [],
    hashtags,
  };
}
```

- [ ] **Step 5: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/x/dom-read.ts src/x/dom-read.test.ts
git commit -m "取り込み: 画面から投稿を読む予備の手段" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: フォルダ選択メニューの見た目

**Files:**
- Create: `src/ui/picker/FolderPicker.tsx`, `src/ui/picker/picker.css`
- Test: `src/ui/picker/FolderPicker.test.tsx`

**Interfaces:**
- Consumes: `Folder`（計画1）
- Produces: `PICKER_AUTO_CLOSE_MS = 8000`、`type PickerAnchor = { top: number; left: number } | null`、`type CreateFolderError = "empty" | "duplicate"`、`FolderPicker(props: FolderPickerProps)`（props: `folders`, `selected`, `anchor`, `onToggle(folderId, on)`, `onCreate(name): Promise<CreateFolderError | null>`, `onClose()`）

- [ ] **Step 1: 開発用の依存を入れる**

Run: `npm install -D @testing-library/react @testing-library/dom`

- [ ] **Step 2: 失敗するテストを書く**

`src/ui/picker/FolderPicker.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Folder } from "../../core/types";
import { FolderPicker, PICKER_AUTO_CLOSE_MS } from "./FolderPicker";

const folders: Folder[] = [
  { id: "a", name: "ゲーム", description: "", order: 0, createdAt: "" },
  { id: "b", name: "料理", description: "", order: 1, createdAt: "" },
];

function setup(over: Partial<Parameters<typeof FolderPicker>[0]> = {}) {
  const props = {
    folders,
    selected: ["b"],
    anchor: { top: 10, left: 20 },
    onToggle: vi.fn(),
    onCreate: vi.fn(async () => null),
    onClose: vi.fn(),
    ...over,
  };
  render(<FolderPicker {...props} />);
  return props;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("FolderPicker", () => {
  it("フォルダを並べ、入っているものは押された状態", () => {
    setup();
    expect(screen.getByRole("button", { name: "ゲーム" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "料理" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("押すと出し入れを知らせる", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "ゲーム" }));
    fireEvent.click(screen.getByRole("button", { name: "料理" }));
    expect(p.onToggle.mock.calls).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });

  it("フォルダが無ければその旨を出す", () => {
    setup({ folders: [] });
    expect(screen.getByText("フォルダがまだありません")).toBeTruthy();
  });

  it("新しいフォルダ: 失敗なら理由を出し、成功なら入力を空にする", async () => {
    const onCreate = vi.fn(async (name: string) => (name === "料理" ? ("duplicate" as const) : null));
    setup({ onCreate });
    const input = screen.getByLabelText("新しいフォルダの名前") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "料理" } });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });
    expect(screen.getByRole("alert").textContent).toBe("同じ名前のフォルダがあります");
    fireEvent.change(input, { target: { value: "旅行" } });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });
    expect(onCreate).toHaveBeenLastCalledWith("旅行");
    expect(input.value).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("8 秒操作がなければ閉じる。操作すると数え直す", () => {
    const p = setup();
    act(() => {
      vi.advanceTimersByTime(PICKER_AUTO_CLOSE_MS - 3000);
    });
    fireEvent.click(screen.getByRole("button", { name: "ゲーム" }));
    act(() => {
      vi.advanceTimersByTime(PICKER_AUTO_CLOSE_MS - 1000);
    });
    expect(p.onClose).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(p.onClose).toHaveBeenCalledTimes(1);
  });

  it("× で閉じる", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(p.onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: 失敗を確かめる**

Run: `npx vitest run src/ui/picker/FolderPicker.test.tsx`
Expected: FAIL（`./FolderPicker` が見つからない）

- [ ] **Step 4: 実装する**

`src/ui/picker/FolderPicker.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from "react";
import type { Folder } from "../../core/types";

export const PICKER_AUTO_CLOSE_MS = 8000;
export type PickerAnchor = { top: number; left: number } | null;
export type CreateFolderError = "empty" | "duplicate";

export type FolderPickerProps = {
  folders: Folder[];
  selected: string[];
  /** 画面上の位置。null なら画面の左下に出す */
  anchor: PickerAnchor;
  onToggle: (folderId: string, on: boolean) => void;
  onCreate: (name: string) => Promise<CreateFolderError | null>;
  onClose: () => void;
};

const ERROR_TEXT: Record<CreateFolderError, string> = {
  empty: "名前を入れてください",
  duplicate: "同じ名前のフォルダがあります",
};

/** ブクマした瞬間に出す、フォルダを選ぶ小さなメニュー */
export function FolderPicker({ folders, selected, anchor, onToggle, onCreate, onClose }: FolderPickerProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<CreateFolderError | null>(null);
  const [lastTouch, setLastTouch] = useState(0);

  useEffect(() => {
    const timer = setTimeout(onClose, PICKER_AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [lastTouch, onClose]);

  const touch = () => setLastTouch((n) => n + 1);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    touch();
    const result = await onCreate(name);
    setError(result);
    if (!result) setName("");
  };

  return (
    <div
      className={anchor ? "tt-picker" : "tt-picker tt-picker--corner"}
      style={anchor ? { top: anchor.top, left: anchor.left } : undefined}
      role="dialog"
      aria-label="ツイッ棚のフォルダ"
      onPointerEnter={touch}
      onPointerDown={touch}
      onKeyDown={touch}
    >
      <div className="tt-picker__head">
        <span>ツイッ棚に整理</span>
        <button type="button" className="tt-picker__close" aria-label="閉じる" onClick={onClose}>
          ×
        </button>
      </div>
      {folders.length === 0 ? (
        <p className="tt-picker__empty">フォルダがまだありません</p>
      ) : (
        <ul className="tt-picker__list">
          {folders.map((f) => {
            const on = selected.includes(f.id);
            return (
              <li key={f.id}>
                <button
                  type="button"
                  className="tt-picker__chip"
                  aria-pressed={on}
                  onClick={() => {
                    touch();
                    onToggle(f.id, !on);
                  }}
                >
                  {f.name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <form className="tt-picker__new" onSubmit={submit}>
        <input
          value={name}
          onChange={(e) => {
            touch();
            setName(e.target.value);
          }}
          placeholder="新しいフォルダ"
          aria-label="新しいフォルダの名前"
        />
        <button type="submit">追加</button>
      </form>
      {error && (
        <p className="tt-picker__error" role="alert">
          {ERROR_TEXT[error]}
        </p>
      )}
    </div>
  );
}
```

`src/ui/picker/picker.css`（Shadow DOM の中で使う。Tailwind は使わない）:

```css
.tt-picker,
.tt-counter {
  position: fixed;
  z-index: 2147483647;
  box-sizing: border-box;
  font-family: system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif;
  font-size: 13px;
  line-height: 1.4;
  color: #2b2118;
  background: #fffaf3;
  border: 1px solid #d9c7b0;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgb(0 0 0 / 0.18);
}

.tt-picker {
  width: 260px;
  max-height: 240px;
  overflow: auto;
  padding: 10px 12px;
}

.tt-picker--corner,
.tt-counter {
  left: 16px;
  bottom: 16px;
}

.tt-picker__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 700;
  margin-bottom: 8px;
}

.tt-picker__close {
  border: none;
  background: transparent;
  font-size: 16px;
  cursor: pointer;
  color: inherit;
}

.tt-picker__list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 8px;
  padding: 0;
  list-style: none;
}

.tt-picker__chip {
  border: 1px solid #c9b291;
  border-radius: 999px;
  padding: 3px 10px;
  background: #ffffff;
  color: inherit;
  cursor: pointer;
  font: inherit;
}

.tt-picker__chip[aria-pressed="true"] {
  background: #7c5a3a;
  border-color: #7c5a3a;
  color: #ffffff;
}

.tt-picker__empty {
  margin: 0 0 8px;
  color: #7a6a58;
}

.tt-picker__new {
  display: flex;
  gap: 6px;
}

.tt-picker__new input {
  flex: 1;
  min-width: 0;
  border: 1px solid #d9c7b0;
  border-radius: 8px;
  padding: 4px 8px;
  font: inherit;
}

.tt-picker__new button {
  border: none;
  border-radius: 8px;
  padding: 4px 10px;
  background: #7c5a3a;
  color: #ffffff;
  cursor: pointer;
  font: inherit;
}

.tt-picker__error {
  margin: 6px 0 0;
  color: #b42318;
}

.tt-counter {
  padding: 6px 12px;
}

.tt-counter__warn {
  display: block;
  margin-top: 2px;
  color: #b42318;
}

@media (prefers-color-scheme: dark) {
  .tt-picker,
  .tt-counter {
    color: #f3e9dc;
    background: #2a221b;
    border-color: #5a4836;
  }
  .tt-picker__chip,
  .tt-picker__new input {
    background: #1d1712;
    color: #f3e9dc;
    border-color: #5a4836;
  }
  .tt-picker__empty {
    color: #b8a690;
  }
}
```

- [ ] **Step 5: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/ui/picker
git commit -m "取り込み: フォルダ選択メニューの見た目" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: 橋渡し係

**Files:**
- Create: `src/bridge/store.ts`, Test: `src/bridge/store.test.ts`
- Create: `src/bridge/BridgeApp.tsx`, `src/bridge/bg-client.ts`, `src/entrypoints/x-bridge.content.tsx`

**Interfaces:**
- Consumes: `FolderPicker`, `PickerAnchor`, `CreateFolderError`（Task 7）、`BgRequest`, `BgResponseMap`（Task 5）、`hasParseWarning`（Task 5）、`findBookmarkButton`, `postIdFromArticle`, `readPostFromArticle`, `partialPost`（Task 6）、`isHookMessage`, `HookMessage`（Task 3）、`Folder`, `CapturedPost`（計画1）
- Produces（`store.ts`）: `PICKER_WIDTH = 260`、`PICKER_HEIGHT = 240`、`type PickerView`、`type CounterView`、`type BridgeState`、`createStore(): BridgeStore`（`get` / `set(update)` / `subscribe`）、`anchorFromRect(rect: { top: number; bottom: number; left: number }, viewport: { width: number; height: number }): { top: number; left: number }`
- Produces（`bg-client.ts`）: `sendToBackground<K extends BgRequest["type"]>(req: Extract<BgRequest, { type: K }>): Promise<BgResponseMap[K]>`、`savePostsQueued(posts: CapturedPost[]): Promise<BgResponseMap["save-posts"] | null>`
- Produces（`BridgeApp.tsx`）: `type BridgeActions = { toggle(folderId: string, on: boolean): void; create(name: string): Promise<CreateFolderError | null>; closePicker(): void }`、`BridgeApp(props: { store: BridgeStore; actions: BridgeActions })`

- [ ] **Step 1: 失敗するテストを書く**

`src/bridge/store.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { anchorFromRect, createStore, PICKER_HEIGHT, PICKER_WIDTH } from "./store";

describe("createStore", () => {
  it("更新すると購読者に知らせる。解除後は知らせない", () => {
    const store = createStore();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.set((s) => ({ ...s, counter: { sessionCount: 1, total: 10, warning: false } }));
    expect(store.get().counter?.total).toBe(10);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    store.set((s) => ({ ...s, counter: null }));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("anchorFromRect", () => {
  const viewport = { width: 1200, height: 800 };
  it("ボタンの下に、ボタンの中心に寄せて出す", () => {
    expect(anchorFromRect({ top: 100, bottom: 130, left: 500 }, viewport)).toEqual({ top: 138, left: 500 - PICKER_WIDTH / 2 });
  });
  it("下に入りきらなければ上に出す", () => {
    expect(anchorFromRect({ top: 700, bottom: 730, left: 500 }, viewport)).toEqual({ top: 700 - 8 - PICKER_HEIGHT, left: 370 });
  });
  it("画面の左右の端からはみ出さない", () => {
    expect(anchorFromRect({ top: 100, bottom: 130, left: 10 }, viewport).left).toBe(8);
    expect(anchorFromRect({ top: 100, bottom: 130, left: 1190 }, viewport).left).toBe(1200 - PICKER_WIDTH - 8);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/bridge/store.test.ts`
Expected: FAIL（`./store` が見つからない）

- [ ] **Step 3: 状態と位置の計算を実装する**

`src/bridge/store.ts`:

```ts
import type { Folder } from "../core/types";
import type { PickerAnchor } from "../ui/picker/FolderPicker";

export const PICKER_WIDTH = 260;
export const PICKER_HEIGHT = 240;
const GAP = 8;

export type PickerView = { postId: string; anchor: PickerAnchor; folders: Folder[]; selected: string[] };
export type CounterView = { sessionCount: number; total: number | null; warning: boolean };
export type BridgeState = { picker: PickerView | null; counter: CounterView | null };

export function createStore() {
  let state: BridgeState = { picker: null, counter: null };
  const listeners = new Set<() => void>();
  return {
    get: (): BridgeState => state,
    set(update: (s: BridgeState) => BridgeState): void {
      state = update(state);
      for (const l of listeners) l();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type BridgeStore = ReturnType<typeof createStore>;

/** ブクマボタンの位置から、メニューを出す位置を決める（画面からはみ出さない） */
export function anchorFromRect(
  rect: { top: number; bottom: number; left: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  const below = rect.bottom + GAP;
  const top = below + PICKER_HEIGHT <= viewport.height ? below : Math.max(GAP, rect.top - GAP - PICKER_HEIGHT);
  const left = Math.min(Math.max(GAP, rect.left - PICKER_WIDTH / 2), viewport.width - PICKER_WIDTH - GAP);
  return { top, left };
}
```

- [ ] **Step 4: 画面・依頼・入口を書く**

`src/bridge/BridgeApp.tsx`:

```tsx
import { useSyncExternalStore } from "react";
import { FolderPicker, type CreateFolderError } from "../ui/picker/FolderPicker";
import type { BridgeStore } from "./store";

export type BridgeActions = {
  toggle(folderId: string, on: boolean): void;
  create(name: string): Promise<CreateFolderError | null>;
  closePicker(): void;
};

/** x.com の上に重ねる画面（フォルダ選択メニューと、ブクマ画面の取り込み件数） */
export function BridgeApp({ store, actions }: { store: BridgeStore; actions: BridgeActions }) {
  const state = useSyncExternalStore(store.subscribe, store.get);
  return (
    <>
      {state.picker && (
        <FolderPicker
          key={state.picker.postId}
          folders={state.picker.folders}
          selected={state.picker.selected}
          anchor={state.picker.anchor}
          onToggle={actions.toggle}
          onCreate={actions.create}
          onClose={actions.closePicker}
        />
      )}
      {state.counter && !state.picker && (
        <div className="tt-counter" role="status">
          ツイッ棚：このページで {state.counter.sessionCount} 件取り込み
          {state.counter.total !== null && `（全 ${state.counter.total} 件）`}
          {state.counter.warning && <span className="tt-counter__warn">X の仕様が変わったようです。更新をお待ちください</span>}
        </div>
      )}
    </>
  );
}
```

`src/bridge/bg-client.ts`:

```ts
import { browser } from "#imports";
import type { BgRequest, BgResponseMap } from "../background/protocol";
import type { CapturedPost } from "../core/types";

const RETRIES = 3;
const RETRY_WAIT_MS = 300;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 裏方へ依頼する。眠っていて返事が無いときは少し待って最大 3 回まで送り直す */
export async function sendToBackground<K extends BgRequest["type"]>(
  req: Extract<BgRequest, { type: K }>,
): Promise<BgResponseMap[K]> {
  let lastError: unknown;
  for (let i = 0; i < RETRIES; i++) {
    try {
      const res: unknown = await browser.runtime.sendMessage(req);
      if (typeof res === "object" && res !== null && "error" in res) throw new Error(String((res as { error: unknown }).error));
      return res as BgResponseMap[K];
    } catch (e) {
      lastError = e;
      await wait(RETRY_WAIT_MS * (i + 1));
    }
  }
  throw lastError;
}

const pending: CapturedPost[] = [];

/** 投稿を保存させる。失敗したらページ内にためて、次に保存するときに一緒に送る */
export async function savePostsQueued(posts: CapturedPost[]): Promise<BgResponseMap["save-posts"] | null> {
  const batch = [...pending.splice(0), ...posts];
  try {
    return await sendToBackground<"save-posts">({ type: "save-posts", posts: batch });
  } catch {
    pending.push(...batch);
    return null;
  }
}
```

`src/entrypoints/x-bridge.content.tsx`:

```tsx
import "../ui/picker/picker.css";
import { createRoot, type Root } from "react-dom/client";
import { createShadowRootUi, defineContentScript } from "#imports";
import { savePostsQueued, sendToBackground } from "../bridge/bg-client";
import { BridgeApp, type BridgeActions } from "../bridge/BridgeApp";
import { anchorFromRect, createStore } from "../bridge/store";
import { hasParseWarning } from "../core/health";
import { findBookmarkButton, partialPost, postIdFromArticle, readPostFromArticle } from "../x/dom-read";
import { isHookMessage, type HookMessage } from "../x/messages";

const BOOKMARKS_PATH = /^\/i\/bookmarks(\/|$)/;
const CLICK_MEMORY_MS = 5000;

type LastClick = { postId: string | null; article: Element | null; rect: DOMRect; at: number };

function waitForBody(): Promise<void> {
  if (document.body) return Promise.resolve();
  return new Promise((resolve) => document.addEventListener("DOMContentLoaded", () => resolve(), { once: true }));
}

/**
 * 橋渡し係。取り込み係からのメッセージを検査して裏方に保存させ、
 * ブクマした瞬間のメニューと、ブクマ画面の取り込み件数を出す。
 */
export default defineContentScript({
  matches: ["https://x.com/*"],
  runAt: "document_start",
  cssInjectionMode: "ui",
  async main(ctx) {
    const store = createStore();
    let lastClick: LastClick | null = null;
    let sessionCount = 0;

    ctx.addEventListener(
      document,
      "click",
      (e) => {
        const button = findBookmarkButton(e.target);
        if (!button) return;
        const article = button.closest("article");
        lastClick = { postId: article ? postIdFromArticle(article) : null, article, rect: button.getBoundingClientRect(), at: Date.now() };
      },
      { capture: true },
    );

    const refreshCounter = async () => {
      if (!BOOKMARKS_PATH.test(location.pathname)) {
        store.set((s) => ({ ...s, counter: null }));
        return;
      }
      try {
        const stats = await sendToBackground<"get-stats">({ type: "get-stats" });
        store.set((s) => ({ ...s, counter: { sessionCount, total: stats.total, warning: hasParseWarning(stats.health) } }));
      } catch {
        store.set((s) => ({ ...s, counter: { sessionCount, total: null, warning: false } }));
      }
    };

    const recentClickFor = (postId: string): LastClick | null => {
      const c = lastClick;
      if (!c || Date.now() - c.at > CLICK_MEMORY_MS) return null;
      return c.postId === null || c.postId === postId ? c : null;
    };

    const onHook = async (m: HookMessage) => {
      switch (m.type) {
        case "bookmarks-seen": {
          const res = await savePostsQueued(m.posts);
          if (res) sessionCount += m.posts.length;
          await refreshCounter();
          return;
        }
        case "bookmark-added": {
          const click = recentClickFor(m.postId);
          const post = m.post ?? (click?.article ? readPostFromArticle(click.article, m.postId) : partialPost(m.postId));
          await savePostsQueued([post]);
          const picker = await sendToBackground<"get-picker-state">({ type: "get-picker-state", postId: m.postId });
          if (!picker.enabled) return;
          const anchor = click ? anchorFromRect(click.rect, { width: window.innerWidth, height: window.innerHeight }) : null;
          store.set((s) => ({ ...s, picker: { postId: m.postId, anchor, folders: picker.folders, selected: picker.selected } }));
          return;
        }
        case "bookmark-removed":
          await sendToBackground<"mark-removed">({ type: "mark-removed", postId: m.postId });
          return;
        case "parse-error":
          await sendToBackground<"report-parse-error">({ type: "report-parse-error", op: m.op });
          await refreshCounter();
          return;
      }
    };

    ctx.addEventListener(window, "message", (e) => {
      if (e.source !== window || e.origin !== location.origin || !isHookMessage(e.data)) return;
      onHook(e.data).catch(() => {
        // 保存に失敗しても X の画面は壊さない
      });
    });

    ctx.addEventListener(window, "wxt:locationchange", () => {
      sessionCount = 0;
      void refreshCounter();
    });

    const actions: BridgeActions = {
      toggle(folderId, on) {
        const picker = store.get().picker;
        if (!picker) return;
        sendToBackground<"set-folder">({ type: "set-folder", postId: picker.postId, folderId, on })
          .then((res) => store.set((s) => (s.picker ? { ...s, picker: { ...s.picker, selected: res.selected } } : s)))
          .catch(() => {});
      },
      async create(name) {
        const picker = store.get().picker;
        const res = await sendToBackground<"create-folder">({ type: "create-folder", name, postId: picker?.postId });
        if (!res.ok) return res.error;
        store.set((s) =>
          s.picker ? { ...s, picker: { ...s.picker, folders: [...s.picker.folders, res.folder], selected: res.selected } } : s,
        );
        return null;
      },
      closePicker() {
        store.set((s) => ({ ...s, picker: null }));
      },
    };

    await waitForBody();
    const ui = await createShadowRootUi<Root>(ctx, {
      name: "twittana-ui",
      position: "inline",
      anchor: "body",
      onMount(container) {
        const el = document.createElement("div");
        container.append(el);
        const root = createRoot(el);
        root.render(<BridgeApp store={store} actions={actions} />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();
    void refreshCounter();
  },
});
```

- [ ] **Step 5: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし
Run: `npm run build` → 成功。`manifest.json` の `content_scripts` に MAIN world の取り込み係と、通常の橋渡し係（`css` を持たない＝Shadow DOM に入れる）の 2 つがある

- [ ] **Step 6: Commit**

```bash
git add src/bridge src/entrypoints/x-bridge.content.tsx
git commit -m "取り込み: 橋渡し係（保存の中継・メニュー・取り込み件数）" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: 手で確かめる手順

**Files:**
- Modify: `README.md`（開発中の読み込み手順）
- Create: `docs/manual-test.md`
- Modify: `task.md`

- [ ] **Step 1: README に開発手順を足す**

`README.md` の「## 状態」の前に次を足す:

````markdown
## 開発

```bash
npm install
npm run build
```

1. Chrome で `chrome://extensions` を開き、右上の「デベロッパー モード」をオンにする
2. 「パッケージ化されていない拡張機能を読み込む」で `.output/chrome-mv3` を選ぶ
3. コードを変えたら `npm run build` し直し、拡張機能の画面で「更新」を押す（`npm run dev` なら自動で読み直す）

テスト: `npm test` / 型チェック: `npm run typecheck` / lint: `npm run lint`

テストや型チェックが `.wxt/tsconfig.json` が無いと言って落ちるときは、`npx wxt prepare` を一度実行する。
````

- [ ] **Step 2: 手で確かめる表を書く**

`docs/manual-test.md`:

```markdown
# 手で確かめる表

公開前とリリースごとに、実際の x.com で上から順に確かめる。自動操作（ログインの自動化など）はしない。

保存されたデータの見方: `chrome://extensions` → ツイッ棚 →「Service Worker」→ 開いた DevTools の Application → IndexedDB → `twittana`

## 取り込み

| # | 操作 | 期待すること |
|---|---|---|
| 1 | x.com のブックマーク（`/i/bookmarks`）を開く | 左下に「ツイッ棚：このページで N 件取り込み（全 M 件）」が出る |
| 2 | ブクマ画面を下までスクロールする | N と M が増える。IndexedDB の `posts` に本文・投稿者・画像 URL・`bookmarkOrder` が入っている |
| 3 | ホームのタイムラインで、ある投稿をブクマする | ボタンの近くにフォルダ選択メニューが出る。`posts` にその投稿が入る |
| 4 | メニューで「新しいフォルダ」に名前を入れて追加 | フォルダができ、その投稿が入った状態（押された見た目）になる |
| 5 | メニューのフォルダを押して出し入れする | 押した見た目が変わり、`posts` の `folders` と `sortedByUser: true` が変わる |
| 6 | 何も触らずに 8 秒待つ | メニューが閉じる |
| 7 | 投稿の詳細ページ（`/ユーザー名/status/ID`）でブクマする | メニューが出て、`posts` に入る |
| 8 | ブクマを外す | `posts` のその投稿が消えずに `removedOnX: true` になる |
| 9 | 同じ投稿をもう一度ブクマ画面で見る | `removedOnX: false` に戻る。フォルダはそのまま |
| 10 | 上の操作の間、X の画面 | タイムラインの読み込み・画像・動画・いいね・ブクマが普段どおり動く。コンソールにツイッ棚由来のエラーが出ない |
| 11 | 拡張アイコン | 今日の積みツイ崩しの残り件数（取り込みがあれば 1〜5）が出る。押すと本棚画面が開く |
```

- [ ] **Step 3: task.md を更新する**

`task.md` の「今やっていること」の計画2の行を `- [x] 計画2：X からの取り込み（docs/superpowers/plans/2026-10-02-twittana-b-capture.md）` にし、その下に次の 1 行を足す:

```markdown
- [ ] 計画2の手での確認（`docs/manual-test.md` の「取り込み」）。実際の X アカウントが要るのでユーザーが行う
```

- [ ] **Step 4: Commit・push**

```bash
git add README.md docs/manual-test.md task.md
git commit -m "取り込み: 開発中の読み込み手順と手で確かめる表" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```
