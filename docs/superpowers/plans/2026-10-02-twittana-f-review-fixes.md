# ツイッ棚 計画6：見直しで見つかった不具合の修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 計画1〜3のコードの見直し（2026-10-02）で見つかった 10 件の不具合と弱点を直す。

**Architecture:** 直し方の方針は 3 つ。①投稿の形の検査と上限の切り詰めを `src/core/post-shape.ts` にまとめ、取り込み係・橋渡し係・読み込みの 3 か所で同じ基準を使う。②x.com 上の画面は「利用者が本当に押したとき」だけメニューを出し、Shadow DOM を閉じ、キー入力を X に漏らさない。③画面と記録の順序の取り違え（選択の残り・別の投稿への反映・警告の消え方）をなくす。

**Tech Stack:** 計画1〜4と同じ

**Spec:** [`docs/superpowers/specs/2026-10-02-twittana-design.md`](../specs/2026-10-02-twittana-design.md)

**前提:** 計画1〜4 が完了していること。計画4で変わったファイル（`x-bridge.content.tsx` の `setLanguage`、`handlers.ts` の `language`、`FolderPicker.tsx` の `t()`、`Shelf.tsx` の `<AiStatus />`、`x-hook.content.ts` の開発用の生データ出力）は、その変更を残したまま直す。各タスクで、まず対象ファイルの今の中身を読むこと。

## Global Constraints

- 計画1〜4の Global Constraints をすべて守る
- 直すたびに、その不具合を再現するテストを先に書いて落ちることを確かめる（テストで確かめられない `x-bridge.content.tsx` の配線は、計画5の E2E で確かめる）

## Review Focus

（見直しの指摘そのものが Review Focus。各タスクの冒頭に指摘の番号を書く）

---

### Task 1: まとめて操作の選択が、見えなくなった投稿に残る（指摘1・高）

**Files:**
- Modify: `src/dashboard/Shelf.tsx`
- Test: `src/dashboard/Shelf.test.tsx`（足す）

- [ ] **Step 1: 失敗するテストを足す**

`src/dashboard/Shelf.test.tsx` の `describe("Shelf", ...)` の中の末尾に足す:

```tsx
  it("操作して一覧から消えた投稿は、次のまとめて操作に含まれない", async () => {
    await db.folders.bulkPut([
      { id: "a", name: "ゲーム", description: "", order: 0, createdAt: "" },
      { id: "b", name: "料理", description: "", order: 1, createdAt: "" },
    ]);
    await db.posts.bulkPut([
      makePost({ id: "1", text: "一つ目", bookmarkOrder: "20", review: { count: 1, lastAt: "2026-01-01T00:00:00.000Z" } }),
      makePost({ id: "5", text: "二つ目", bookmarkOrder: "10", review: { count: 1, lastAt: "2026-01-01T00:00:00.000Z" } }),
    ]);
    renderShelf();
    fireEvent.click(await screen.findByRole("button", { name: /未整理/ }));
    const list = await screen.findByRole("list", { name: "投稿の一覧" });
    await waitFor(() => expect(within(list).getAllByRole("checkbox")).toHaveLength(2));
    fireEvent.click(within(list).getAllByRole("checkbox")[0] as HTMLElement);
    fireEvent.change(screen.getByLabelText("フォルダを選ぶ"), { target: { value: "a" } });
    fireEvent.click(screen.getByRole("button", { name: "入れる" }));
    await waitFor(() => expect(within(list).getAllByRole("checkbox")).toHaveLength(1));

    fireEvent.click(within(list).getAllByRole("checkbox")[0] as HTMLElement);
    expect(screen.getByText("1 件を選択中")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("フォルダを選ぶ"), { target: { value: "b" } });
    fireEvent.click(screen.getByRole("button", { name: "入れる" }));
    await waitFor(async () => expect((await db.posts.get("5"))?.folders).toEqual([{ folderId: "b", by: "manual" }]));
    expect((await db.posts.get("1"))?.folders).toEqual([{ folderId: "a", by: "manual" }]);
  });
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/dashboard/Shelf.test.tsx`
Expected: FAIL（「2 件を選択中」になる、または投稿 1 に b も入る）

- [ ] **Step 3: 直す**

`src/dashboard/Shelf.tsx`:
- `const list = useMemo(...)` の次の行に足す: `const visibleIds = useMemo(() => new Set(list.map((p) => p.id)), [list]);`
- `const ids = [...selected];` を `const ids = [...selected].filter((id) => visibleIds.has(id)); // 一覧から消えた投稿は操作しない` にする
- `{selected.size > 0 && (` を `{ids.length > 0 && (` に、`count={selected.size}` を `count={ids.length}` にする

- [ ] **Step 4: すべて通ることを確かめて Commit**

Run: `npm test` → PASS / `npm run typecheck` / `npm run lint` → エラーなし

```bash
git add src/dashboard/Shelf.tsx src/dashboard/Shelf.test.tsx
git commit -m "修正: まとめて操作の選択が、一覧から消えた投稿に残っていた" -m "<Co-Authored-By 行>"
```

---

### Task 2: 投稿の形の検査と切り詰めを 1 か所にまとめる（指摘2・4・9）

**Files:**
- Create: `src/core/post-shape.ts`、Test: `src/core/post-shape.test.ts`
- Modify: `src/x/messages.ts`（全体を置き換え）、`src/x/messages.test.ts`（全体を置き換え）、`src/x/hook-core.ts`、`src/core/export-format.ts`、`src/core/export-format.test.ts`（足す）

**Interfaces:**
- Produces（`post-shape.ts`）: `POST_LIMITS`、`isAllowedMediaUrl(url: string): boolean`、`isPostUrl(url: string): boolean`、`clampCaptured(p: CapturedPost): CapturedPost`、`isCapturedPostShape(v: unknown): v is CapturedPost`
- Produces（`messages.ts`）: `HookMessage` の `bookmarks-seen` は `posts: unknown[]`、`bookmark-added` は `post: unknown`（中身の検査は受け取った側で `splitValidPosts`）、`splitValidPosts(posts: unknown[]): { valid: CapturedPost[]; invalid: number }`

- [ ] **Step 1: 失敗するテストを書く**

`src/core/post-shape.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeCaptured } from "../test/factories";
import { clampCaptured, isAllowedMediaUrl, isCapturedPostShape, isPostUrl, POST_LIMITS } from "./post-shape";

describe("isAllowedMediaUrl / isPostUrl", () => {
  it("X の画像・動画配信の https だけ許す", () => {
    expect(isAllowedMediaUrl("https://pbs.twimg.com/media/A.jpg?name=small")).toBe(true);
    expect(isAllowedMediaUrl("https://abs.twimg.com/sticky/default_profile_images/a.png")).toBe(true);
    expect(isAllowedMediaUrl("https://video.twimg.com/v.mp4")).toBe(true);
    expect(isAllowedMediaUrl("http://pbs.twimg.com/a.jpg")).toBe(false);
    expect(isAllowedMediaUrl("https://tracker.example/a.gif")).toBe(false);
    expect(isAllowedMediaUrl("javascript:alert(1)")).toBe(false);
  });
  it("投稿の URL は https://x.com だけ", () => {
    expect(isPostUrl("https://x.com/a/status/1")).toBe(true);
    expect(isPostUrl("https://x.com.evil.example/a")).toBe(false);
    expect(isPostUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("clampCaptured", () => {
  it("長い本文・多すぎる配列を上限で切り、許されない画像を外す", () => {
    const p = clampCaptured(
      makeCaptured({
        text: "あ".repeat(POST_LIMITS.text + 10),
        hashtags: Array.from({ length: POST_LIMITS.hashtags + 5 }, (_, i) => `t${i}`),
        links: Array.from({ length: POST_LIMITS.links + 5 }, (_, i) => ({ url: `https://e.example/${i}`, domain: "e.example" })),
        media: [
          { type: "photo", url: "https://pbs.twimg.com/media/A.jpg", thumbUrl: "https://pbs.twimg.com/media/A.jpg?name=small" },
          { type: "photo", url: "https://tracker.example/b.jpg", thumbUrl: "https://tracker.example/b.jpg" },
        ],
        author: { id: "u", handle: "h", name: "n", avatarUrl: "https://tracker.example/me.png" },
        quoted: { id: "9", authorHandle: "q", text: "い".repeat(POST_LIMITS.text + 1) },
      }),
    );
    expect(p.text).toHaveLength(POST_LIMITS.text);
    expect(p.hashtags).toHaveLength(POST_LIMITS.hashtags);
    expect(p.links).toHaveLength(POST_LIMITS.links);
    expect(p.media.map((m) => m.url)).toEqual(["https://pbs.twimg.com/media/A.jpg"]);
    expect(p.author.avatarUrl).toBe("");
    expect(p.quoted?.text).toHaveLength(POST_LIMITS.text);
    expect(isCapturedPostShape(p)).toBe(true);
  });
});

describe("isCapturedPostShape", () => {
  it("正しい形なら true", () => {
    expect(isCapturedPostShape(makeCaptured())).toBe(true);
    expect(isCapturedPostShape(makeCaptured({ quoted: { id: "1", authorHandle: "a", text: "t" }, bookmarkOrder: "5", partial: true }))).toBe(true);
    expect(isCapturedPostShape(makeCaptured({ author: { id: "", handle: "", name: "", avatarUrl: "" } }))).toBe(true);
  });
  it("形・URL・上限が違えば false", () => {
    expect(isCapturedPostShape({ ...makeCaptured(), id: "abc" })).toBe(false);
    expect(isCapturedPostShape({ ...makeCaptured(), url: "https://evil.example/1" })).toBe(false);
    expect(isCapturedPostShape({ ...makeCaptured(), media: [{ type: "audio", url: "u", thumbUrl: "t" }] })).toBe(false);
    expect(isCapturedPostShape({ ...makeCaptured(), media: [null] })).toBe(false);
    expect(isCapturedPostShape({ ...makeCaptured(), links: [null] })).toBe(false);
    expect(isCapturedPostShape({ ...makeCaptured(), bookmarkOrder: 5 })).toBe(false);
    expect(isCapturedPostShape({ ...makeCaptured(), text: "あ".repeat(POST_LIMITS.text + 1) })).toBe(false);
    expect(isCapturedPostShape(makeCaptured({ author: { id: "u", handle: "h", name: "n", avatarUrl: "https://tracker.example/a.png" } }))).toBe(false);
    expect(isCapturedPostShape(null)).toBe(false);
  });
});
```

`src/x/messages.test.ts`（全体を置き換え）:

```ts
import { describe, expect, it } from "vitest";
import { makeCaptured } from "../test/factories";
import { HOOK_SOURCE, isHookMessage, MAX_POSTS_PER_MESSAGE, splitValidPosts } from "./messages";

describe("isHookMessage", () => {
  it("4 種類のメッセージを受け付ける（投稿の中身は splitValidPosts で調べる）", () => {
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmarks-seen", posts: [makeCaptured(), { id: "壊れた" }] })).toBe(true);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmark-added", postId: "1", post: null })).toBe(true);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmark-added", postId: "1", post: makeCaptured({ id: "1" }) })).toBe(true);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmark-removed", postId: "1" })).toBe(true);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "parse-error", op: "Bookmarks" })).toBe(true);
  });
  it("差出人・種類・ID・件数が違えば捨てる", () => {
    expect(isHookMessage({ source: "other", type: "parse-error", op: "x" })).toBe(false);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "delete-all" })).toBe(false);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmark-removed", postId: "../1" })).toBe(false);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmark-added", postId: "1", post: makeCaptured({ id: "2" }) })).toBe(false);
    const tooMany = Array.from({ length: MAX_POSTS_PER_MESSAGE + 1 }, (_, i) => makeCaptured({ id: String(i + 1) }));
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmarks-seen", posts: tooMany })).toBe(false);
  });
});

describe("splitValidPosts", () => {
  it("正しい投稿だけを残し、捨てた数を返す（1 件の不正で全部を捨てない）", () => {
    const good = makeCaptured({ id: "1" });
    expect(splitValidPosts([good, { id: "壊れた" }, null])).toEqual({ valid: [good], invalid: 2 });
  });
});
```

`src/core/export-format.test.ts` の `describe("parseImport の失敗", ...)` の中の末尾に足す:

```ts
  it("形が違う（画像の要素が null・並び値が数値・画像が X 以外のサーバー）", () => {
    const base = { app: "twittana", schemaVersion: 1, exportedAt: "x", folders: [], rules: [] };
    expect(parseImport(JSON.stringify({ ...base, posts: [{ ...makePost(), media: [null] }] }))).toEqual({ ok: false, error: "invalid-shape" });
    expect(parseImport(JSON.stringify({ ...base, posts: [{ ...makePost(), bookmarkOrder: 5 }] }))).toEqual({ ok: false, error: "invalid-shape" });
    const tracking = makePost({ author: { id: "u", handle: "h", name: "n", avatarUrl: "https://tracker.example/a.png" } });
    expect(parseImport(JSON.stringify({ ...base, posts: [tracking] }))).toEqual({ ok: false, error: "invalid-shape" });
  });
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/core/post-shape.test.ts src/x/messages.test.ts src/core/export-format.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装する**

`src/core/post-shape.ts`:

```ts
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
```

`src/x/messages.ts`（全体を置き換え）:

```ts
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
```

`src/x/hook-core.ts`:
- `import { clampCaptured } from "../core/post-shape";` を足す
- `cache.add(result.posts);` を次の 2 行に置き換え、以降の `result.posts` をすべて `posts` にする:

```ts
      const posts = result.posts.map(clampCaptured);
      cache.add(posts);
```

`src/core/export-format.ts`:
- `import { isCapturedPostShape } from "./post-shape";` を足す
- `isPost` を次に置き換える（中身の検査は取り込みと同じ基準にする）:

```ts
function isPost(v: unknown): boolean {
  if (!isCapturedPostShape(v)) return false;
  const p = v as unknown as Obj;
  const r = p.review;
  return (
    isStr(p.capturedAt) &&
    Array.isArray(p.folders) &&
    p.folders.every((f) => isObj(f) && isStr(f.folderId) && ASSIGNED_BY.includes(f.by as string)) &&
    isBool(p.sortedByUser) &&
    isBool(p.removedOnX) &&
    isBool(p.hidden) &&
    (p.aiCheckedFoldersVersion === undefined || isNum(p.aiCheckedFoldersVersion)) &&
    isObj(r) &&
    isNum(r.count) &&
    (r.lastAt === undefined || isStr(r.lastAt))
  );
}
```

- [ ] **Step 4: 橋渡し係を新しい形に合わせる**

`src/entrypoints/x-bridge.content.tsx` は Task 3 でまとめて書き直すので、ここでは型エラーが出る箇所だけを最小限に直す（`bookmarks-seen` は `splitValidPosts(m.posts).valid` を保存し、`bookmark-added` は `splitValidPosts(m.post ? [m.post] : []).valid[0]` を使う）。

- [ ] **Step 5: すべて通ることを確かめて Commit**

Run: `npm test` → PASS / `npm run typecheck` / `npm run lint` → エラーなし / `npm run build` → 成功

```bash
git add src/core/post-shape.ts src/core/post-shape.test.ts src/x/messages.ts src/x/messages.test.ts src/x/hook-core.ts src/core/export-format.ts src/core/export-format.test.ts src/entrypoints/x-bridge.content.tsx
git commit -m "修正: 投稿の形の検査と切り詰めを 1 か所にまとめ、1 件の不正で返事ごと捨てない・追跡用の画像 URL を受け付けない" -m "<Co-Authored-By 行>"
```

---

### Task 3: x.com 上の画面を固くする（指摘3・4・7）

**Files:**
- Modify: `src/bridge/store.ts`、`src/bridge/store.test.ts`（足す）、`src/entrypoints/x-bridge.content.tsx`（全体を置き換え）

**Interfaces:**
- Produces（`store.ts`）: `withPickerSelection(s: BridgeState, postId: string, selected: string[]): BridgeState`

- [ ] **Step 1: 失敗するテストを足す**

`src/bridge/store.test.ts` の末尾に足す（`withPickerSelection` を import に足す）:

```ts
describe("withPickerSelection", () => {
  const state = { picker: { postId: "B", anchor: null, folders: [], selected: ["x"] }, counter: null };
  it("今開いているメニューの投稿のときだけ反映する", () => {
    expect(withPickerSelection(state, "B", ["y"]).picker?.selected).toEqual(["y"]);
    expect(withPickerSelection(state, "A", ["y"])).toBe(state);
    expect(withPickerSelection({ picker: null, counter: null }, "B", ["y"]).picker).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/bridge/store.test.ts`
Expected: FAIL（`withPickerSelection` が無い）

- [ ] **Step 3: 実装する**

`src/bridge/store.ts` の末尾に足す:

```ts
/** メニューの選択状態を更新する。返事が届くまでに別の投稿のメニューに変わっていたら何もしない */
export function withPickerSelection(s: BridgeState, postId: string, selected: string[]): BridgeState {
  if (!s.picker || s.picker.postId !== postId) return s;
  return { ...s, picker: { ...s.picker, selected } };
}
```

`src/entrypoints/x-bridge.content.tsx` を次の内容に置き換える（計画4の `setLanguage` を含む。今のファイルに計画どおりでない変更があれば、それも残す）:

```tsx
import "../ui/picker/picker.css";
import { createRoot, type Root } from "react-dom/client";
import { createShadowRootUi, defineContentScript } from "#imports";
import { savePostsQueued, sendToBackground } from "../bridge/bg-client";
import { BridgeApp, type BridgeActions } from "../bridge/BridgeApp";
import { anchorFromRect, createStore, withPickerSelection } from "../bridge/store";
import { hasParseWarning } from "../core/health";
import { setLanguage } from "../i18n";
import { findBookmarkButton, partialPost, postIdFromArticle, readPostFromArticle } from "../x/dom-read";
import { isHookMessage, splitValidPosts, type HookMessage } from "../x/messages";

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
        if (!e.isTrusted) return; // ページ側のスクリプトが作ったクリックは数えない
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
        setLanguage(stats.language);
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

    const reportInvalid = async (invalid: number) => {
      if (invalid > 0) await sendToBackground<"report-parse-error">({ type: "report-parse-error", op: "invalid-post" });
    };

    const onHook = async (m: HookMessage) => {
      switch (m.type) {
        case "bookmarks-seen": {
          const { valid, invalid } = splitValidPosts(m.posts);
          const res = valid.length > 0 ? await savePostsQueued(valid) : null;
          if (res) sessionCount += valid.length;
          await reportInvalid(invalid);
          await refreshCounter();
          return;
        }
        case "bookmark-added": {
          const click = recentClickFor(m.postId);
          const fromHook = splitValidPosts(m.post ? [m.post] : []).valid[0];
          const post = fromHook ?? (click?.article ? readPostFromArticle(click.article, m.postId) : partialPost(m.postId));
          await savePostsQueued([post]);
          // メニューは、利用者が本当にブクマボタンを押したときだけ出す（偽のメッセージでは出さない）
          if (!click) return;
          const picker = await sendToBackground<"get-picker-state">({ type: "get-picker-state", postId: m.postId });
          setLanguage(picker.language);
          if (!picker.enabled) return;
          const anchor = anchorFromRect(click.rect, { width: window.innerWidth, height: window.innerHeight });
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

    // 届いた順に 1 つずつ処理する（保存と「読み取りの調子」の記録の順番を保つため）
    let queue: Promise<void> = Promise.resolve();
    ctx.addEventListener(window, "message", (e) => {
      if (e.source !== window || e.origin !== location.origin || !isHookMessage(e.data)) return;
      const message = e.data;
      queue = queue.then(() => onHook(message)).catch(() => {
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
        const postId = picker.postId;
        sendToBackground<"set-folder">({ type: "set-folder", postId, folderId, on })
          .then((res) => store.set((s) => withPickerSelection(s, postId, res.selected)))
          .catch(() => {});
      },
      async create(name) {
        const postId = store.get().picker?.postId;
        const res = await sendToBackground<"create-folder">({ type: "create-folder", name, postId });
        if (!res.ok) return res.error;
        store.set((s) =>
          s.picker && s.picker.postId === postId
            ? { ...s, picker: { ...s.picker, folders: [...s.picker.folders, res.folder], selected: res.selected } }
            : s,
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
      // ページ側のスクリプトからフォルダ名などを読めないように閉じる（E2E のビルドだけ開く）
      mode: import.meta.env.WXT_E2E === "1" ? "open" : "closed",
      // メニューの入力欄で打ったキーを、X のショートカットに渡さない
      isolateEvents: true,
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

- [ ] **Step 4: すべて通ることを確かめて Commit**

Run: `npm test` → PASS / `npm run typecheck` / `npm run lint` → エラーなし / `npm run build` → 成功

```bash
git add src/bridge/store.ts src/bridge/store.test.ts src/entrypoints/x-bridge.content.tsx
git commit -m "修正: メニューは本当に押したときだけ出し、Shadow DOM を閉じ、キー入力を X に渡さない。別の投稿のメニューに結果を反映しない" -m "<Co-Authored-By 行>"
```

---

### Task 4: 読み取りの警告がすぐ消える（指摘5）

**Files:**
- Modify: `src/x/hook-core.ts`、`src/x/hook-core.test.ts`（足す）、`src/core/health.ts`、`src/core/health.test.ts`（足す）、`src/db/settings.ts`、`src/db/settings.test.ts`（足す）、`src/background/handlers.ts`

**Interfaces:**
- Produces（`settings.ts`）: `updateParseHealth(db, update: (h: ParseHealth) => ParseHealth): Promise<void>`

- [ ] **Step 1: 失敗するテストを足す**

`src/x/hook-core.test.ts` の `describe` の中の末尾に足す:

```ts
  it("一部だけ読めなかったら、保存のあとに parse-error を出す（警告が成功で上書きされないように）", () => {
    const msgs = createHookCore().onResponse(
      "Bookmarks",
      bookmarksResponse([
        { tweet: rawTweet({ id: ID }), sortIndex: "9" },
        { tweet: { __typename: "Tweet", rest_id: "1" }, sortIndex: "8" },
      ]),
    );
    expect(msgs.map((m) => m.type)).toEqual(["bookmarks-seen", "parse-error"]);
  });
```

`src/core/health.test.ts` の `it` の中の末尾に足す:

```ts
    expect(hasParseWarning({ lastOkAt: "2026-10-02T00:00:00.000Z", lastErrorAt: "2026-10-02T00:00:00.000Z" })).toBe(true);
```

`src/db/settings.test.ts` の `describe` の中の末尾に足す（`updateParseHealth` を import に足す）:

```ts
  it("読み取りの調子は、同時に更新しても両方残る", async () => {
    await Promise.all([
      updateParseHealth(db, (h) => ({ ...h, lastOkAt: "2026-10-02T00:00:00.000Z" })),
      updateParseHealth(db, (h) => ({ ...h, lastErrorAt: "2026-10-02T00:00:01.000Z", lastErrorOp: "Bookmarks" })),
    ]);
    expect((await getSettings(db)).parseHealth).toEqual({
      lastOkAt: "2026-10-02T00:00:00.000Z",
      lastErrorAt: "2026-10-02T00:00:01.000Z",
      lastErrorOp: "Bookmarks",
    });
  });
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/x/hook-core.test.ts src/core/health.test.ts src/db/settings.test.ts`
Expected: FAIL

- [ ] **Step 3: 直す**

`src/x/hook-core.ts` の `onResponse`: `parse-error` を `out` に入れる `if` のかたまりを、`bookmarks-seen` を入れる `for` のかたまりの**後ろ**に移す。

`src/core/health.ts`: `return !h.lastOkAt || h.lastErrorAt > h.lastOkAt;` を `return !h.lastOkAt || h.lastErrorAt >= h.lastOkAt;` にする（同じ時刻なら警告を優先）。

`src/db/settings.ts` の末尾に足す（`ParseHealth` を型の import に足す）:

```ts
/** 読み取りの調子を、読んで書くまでを 1 つのトランザクションで更新する（同時の更新で消えないように） */
export async function updateParseHealth(db: TwitTanaDB, update: (h: ParseHealth) => ParseHealth): Promise<void> {
  await db.transaction("rw", db.kv, async () => {
    const { parseHealth } = await getSettings(db);
    await updateSettings(db, { parseHealth: update(parseHealth) });
  });
}
```

`src/background/handlers.ts`:
- `updateParseHealth` を `../db/settings` の import に足す
- `save-posts` の `if (saved.length > 0) { ... }` のかたまりを `if (saved.length > 0) await updateParseHealth(db, (h) => ({ ...h, lastOkAt: now }));` にする
- `report-parse-error` を次にする:

```ts
    case "report-parse-error":
      await updateParseHealth(db, (h) => ({ ...h, lastErrorAt: now, lastErrorOp: req.op }));
      return { ok: true };
```

- [ ] **Step 4: すべて通ることを確かめて Commit**

Run: `npm test` → PASS / `npm run typecheck` / `npm run lint` → エラーなし

```bash
git add src/x/hook-core.ts src/x/hook-core.test.ts src/core/health.ts src/core/health.test.ts src/db/settings.ts src/db/settings.test.ts src/background/handlers.ts
git commit -m "修正: 一部だけ読めなかったときの警告が、直後の保存で消えていた" -m "<Co-Authored-By 行>"
```

---

### Task 5: 画面から読んだ不完全なデータの扱い（指摘6）

**Files:**
- Modify: `src/x/dom-read.ts`、`src/x/dom-read.test.ts`、`src/dashboard/PostCard.tsx`、`src/dashboard/PostCard.test.tsx`（足す）

- [ ] **Step 1: 失敗するテストに直す・足す**

`src/x/dom-read.test.ts`:
- `beforeEach` の HTML の `<div class="quoted"><a href="/carol/status/1973000000000000399">引用</a></div>` を次に置き換える（X の引用は `role="link"` の箱に入っている）:

```html
      <div role="link"><a href="/carol/status/1973000000000000399"><time datetime="2026-08-01T00:00:00.000Z">8月1日</time></a><div data-testid="tweetText">引用元の本文</div><img src="https://pbs.twimg.com/media/Q1?format=jpg&name=small"></div>
```

- `readPostFromArticle` の「画面に出ている範囲で投稿を読む」の期待値の最後（`hashtags: ["推し活"],` の後）に `partial: true,` を足す（画面から読んだものはリンクや引用が欠けるので、あとで通信データが来たら上書きされるように）。メディアは `P1` の 1 件のまま（引用元の `Q1` は入らない）
- 同じ `describe` の中に足す:

```ts
  it("本文の無い投稿で、引用元の本文や画像を自分のものとして取らない", () => {
    document.body.innerHTML = `<article><a href="/alice/status/${ID}"><time datetime="2026-09-01T10:00:00.000Z">x</time></a>
      <div role="link"><div data-testid="tweetText">引用元の本文</div><img src="https://pbs.twimg.com/media/Q1"></div></article>`;
    const p = readPostFromArticle(article(0), ID);
    expect(p.text).toBe("");
    expect(p.media).toEqual([]);
  });
```

`src/dashboard/PostCard.test.tsx` の `describe` の中の末尾に足す:

```tsx
  it("中身が一部だけのときは、読めた本文と案内の両方を出す", () => {
    render(<PostCard post={makePost({ partial: true, text: "読めた本文" })} folders={folders} />);
    expect(screen.getByText("読めた本文")).toBeTruthy();
    expect(screen.getByText("中身は、X のブックマーク画面を開くと入ります")).toBeTruthy();
  });
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/x/dom-read.test.ts src/dashboard/PostCard.test.tsx`
Expected: FAIL

- [ ] **Step 3: 直す**

`src/x/dom-read.ts`:
- 次の関数を足す:

```ts
/** 投稿の枠の中で、引用元（role="link" の箱）に入っていない要素だけ */
function ownElements(article: Element, selector: string): Element[] {
  return [...article.querySelectorAll(selector)].filter((el) => el.closest('[role="link"]') === null);
}
```

- `readPostFromArticle` の `const textEl = article.querySelector('[data-testid="tweetText"]');` を `const textEl = ownElements(article, '[data-testid="tweetText"]')[0];` にする
- `const media: MediaItem[] = [...article.querySelectorAll('img[src*="pbs.twimg.com/media/"]')].map(` を `const media: MediaItem[] = ownElements(article, 'img[src*="pbs.twimg.com/media/"]').map(` にする
- 返す投稿の最後に `partial: true,` を足し、関数の説明コメントに「リンク・引用・投稿者 ID が欠けるので partial とし、通信データが来たら上書きされる」と書く

`src/dashboard/PostCard.tsx` の本文の部分を次にする:

```tsx
          {post.text && <p className="mt-1 whitespace-pre-wrap break-words">{post.text}</p>}
          {post.partial && <p className="mt-1 text-sm text-stone-500">{t("post.partial")}</p>}
```

- [ ] **Step 4: すべて通ることを確かめて Commit**

Run: `npm test` → PASS / `npm run typecheck` / `npm run lint` → エラーなし

```bash
git add src/x/dom-read.ts src/x/dom-read.test.ts src/dashboard/PostCard.tsx src/dashboard/PostCard.test.tsx
git commit -m "修正: 画面から読んだ不完全な投稿が、取り込み済みの完全な中身を上書きしない。引用元を自分の本文として取らない" -m "<Co-Authored-By 行>"
```

---

### Task 6: アイコンの件数・壊れたデータでの真っ白・余計な複製（指摘8・9・10）

**Files:**
- Modify: `src/db/review-repo.ts`、`src/db/review-repo.test.ts`（足す）
- Create: `src/dashboard/ErrorBoundary.tsx`、Test: `src/dashboard/ErrorBoundary.test.tsx`
- Modify: `src/entrypoints/dashboard/App.tsx`、`src/i18n/ja.ts`、`src/i18n/en.ts`
- Modify: `src/x/network-patch.ts`、`src/x/network-patch.test.ts`（足す）、`src/entrypoints/x-hook.content.ts`

- [ ] **Step 1: 失敗するテストを足す・書く**

`src/db/review-repo.test.ts` の `describe("completeReview", ...)` の中の末尾に足す（`setHidden` を `./posts` から import に足す）:

```ts
  it("今日の顔ぶれのうち、非表示にした投稿は残り件数に数えない", async () => {
    await seed(5);
    await updateSettings(db, { reviewPerDay: 2 });
    const t = await ensureTodayReview(db, "2026-10-02");
    await setHidden(db, [t.postIds[0] as string], true);
    expect(await remainingReviewCount(db, "2026-10-02")).toBe(1);
  });
```

`src/dashboard/ErrorBoundary.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Broken(): never {
  throw new Error("壊れたデータ");
}

describe("ErrorBoundary", () => {
  it("中で例外が出たら、真っ白にせず理由と案内を出す", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary resetKey="shelf">
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert").textContent).toContain("壊れたデータ");
    expect(screen.getByRole("button", { name: "もう一度表示する" })).toBeTruthy();
  });

  it("resetKey が変われば（別のタブに移れば）表示し直す", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(
      <ErrorBoundary resetKey="shelf">
        <Broken />
      </ErrorBoundary>,
    );
    rerender(
      <ErrorBoundary resetKey="settings">
        <p>設定</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("設定")).toBeTruthy();
    fireEvent.click(screen.getByText("設定"));
  });
});
```

`src/x/network-patch.test.ts` の `describe("patchFetch", ...)` の中の末尾に足す:

```ts
  it("見張らない URL は知らせず、複製もしない", async () => {
    const target = fakeTarget('{"a":1}');
    let called = false;
    patchFetch(
      target,
      () => {
        called = true;
      },
      (url) => url.includes("/i/api/graphql/"),
    );
    const res = await target.fetch("https://video.twimg.com/v.mp4");
    expect(await res.json()).toEqual({ a: 1 });
    expect(called).toBe(false);
  });
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/db/review-repo.test.ts src/dashboard/ErrorBoundary.test.tsx src/x/network-patch.test.ts`
Expected: FAIL

- [ ] **Step 3: 直す**

`src/db/review-repo.ts` の `remainingReviewCount` を次にする:

```ts
/** 今日の残り件数（非表示にした投稿・消えた投稿は数えない） */
export async function remainingReviewCount(db: TwitTanaDB, today: string): Promise<number> {
  const ids = remainingReviewIds(await ensureTodayReview(db, today));
  const posts = await db.posts.bulkGet(ids);
  return posts.filter((p) => p !== undefined && !p.hidden).length;
}
```

`src/i18n/ja.ts` に足す:

```ts
  "error.render": "表示中に問題が起きました（{message}）。読み込んだデータが壊れているかもしれません。別のタブに移るか、「設定」タブで書き出して退避してください。",
  "error.retry": "もう一度表示する",
```

`src/i18n/en.ts` に足す:

```ts
  "error.render": "Something went wrong while showing this page ({message}). Imported data may be broken. Switch tabs, or export a backup from Settings.",
  "error.retry": "Try again",
```

`src/dashboard/ErrorBoundary.tsx`:

```tsx
import { Component, type ReactNode } from "react";
import { t } from "../i18n";

type Props = { children: ReactNode; resetKey: string };
type State = { error: Error | null };

/** 表示中の例外で画面全体が真っ白にならないようにする。resetKey（タブ）が変われば表示し直す */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidUpdate(prev: Props): void {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="space-y-3 rounded-xl bg-red-100 px-4 py-3 text-red-900 dark:bg-red-950 dark:text-red-100">
        <p>{t("error.render", { message: this.state.error.message })}</p>
        <button type="button" className="underline" onClick={() => this.setState({ error: null })}>
          {t("error.retry")}
        </button>
      </div>
    );
  }
}
```

（`override` が tsconfig の設定で使えない・要らないと言われたら外す）

`src/entrypoints/dashboard/App.tsx`:
- `import { ErrorBoundary } from "../../dashboard/ErrorBoundary";` を足す
- タブの中身 `{tab === "shelf" ? <Shelf /> : tab === "organize" ? <Organize /> : <SettingsPanel />}` を `<ErrorBoundary resetKey={tab}>{...同じ中身...}</ErrorBoundary>` で包む

`src/x/network-patch.ts` の `patchFetch` を次にする:

```ts
/** fetch を包む。shouldWatch が true の URL だけ見る（それ以外は複製もしない）。X の画面に渡す返事には手を加えない */
export function patchFetch(target: { fetch: typeof fetch }, handle: NetworkHandler, shouldWatch: (url: string) => boolean = () => true): void {
  const original = target.fetch;
  target.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const res = await original.call(target, input, init);
    try {
      const url = urlOf(input);
      if (shouldWatch(url)) {
        const copy = res.clone();
        handle(url, init?.body, res.ok, () => copy.json());
      }
    } catch {
      // X の画面は壊さない
    }
    return res;
  };
}
```

`src/entrypoints/x-hook.content.ts` の `patchFetch(window, handle);` を `patchFetch(window, handle, (url) => graphqlOperation(url) !== null);` にする。

- [ ] **Step 4: すべて通ることを確かめて Commit・push**

Run: `npm test` → PASS / `npm run typecheck` / `npm run lint` → エラーなし / `npm run build` → 成功

```bash
git add src/db/review-repo.ts src/db/review-repo.test.ts src/dashboard/ErrorBoundary.tsx src/dashboard/ErrorBoundary.test.tsx src/entrypoints/dashboard/App.tsx src/i18n/ja.ts src/i18n/en.ts src/x/network-patch.ts src/x/network-patch.test.ts src/entrypoints/x-hook.content.ts
git commit -m "修正: アイコンの件数から非表示を除く・表示中の例外で真っ白にしない・GraphQL 以外の返事を複製しない" -m "<Co-Authored-By 行>"
git push
```
