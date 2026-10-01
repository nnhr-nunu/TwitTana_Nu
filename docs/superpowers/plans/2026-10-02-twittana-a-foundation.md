# ツイッ棚 計画1：土台と中核 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 拡張の土台（WXT・React・Tailwind・Vitest・ESLint）と、X やブラウザに依存しない中核ロジック（`src/core/`）、保存の窓口（`src/db/`）を、テスト付きで作る。

**Architecture:** `src/core/` は純粋な TypeScript（WXT・Dexie・React・ブラウザ API を import しない）。`src/db/` は Dexie で IndexedDB を扱い、関数はすべて第1引数に `db` を受け取る（テストで別 DB を渡すため）。時刻は呼び出し側から ISO 文字列 `now` で渡し、関数の中で `new Date()` を呼ばない。

**Tech Stack:** WXT 0.21 / React 19 / Tailwind 4 / Dexie 4 / Vitest 5 / fake-indexeddb 6 / TypeScript 5 / Node 24 / npm 11

**Spec:** [`docs/superpowers/specs/2026-10-02-twittana-design.md`](../specs/2026-10-02-twittana-design.md)（この計画は 4・7・9・10・12・13 章のうち、画面と X に依存しない部分を実装する）

この計画は全4本の1本目。2本目以降（X からの取り込み／本棚画面／AI 分類と公開準備）は、この計画の完了後に実際のコードを見て書く。

## Global Constraints

- `src/core/` は `wxt`・`#imports`・`dexie`・`react`・`browser`・`chrome` を import しない
- 外部サーバーへの通信をするコードを書かない。X API を呼ばない
- 1 ファイル 800 行以内
- テストはソースの隣に `*.test.ts` で置く
- 時刻は引数 `now: string`（ISO 8601）または `today: string`（`YYYY-MM-DD`）で受け取る
- ID の生成は `crypto.randomUUID()`
- コミットは日本語の 1 行メッセージ＋`-m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`。bash の heredoc は使わない（AGENTS.md）
- 各タスクの最後に `npm test`・`npm run typecheck`・`npm run lint` がすべて通ること

## Review Focus

- 全角・半角・大文字小文字の違い（「ＡＢＣ」「ｶﾀｶﾅ」「＃タグ」）でルールが当たらない → 同じ文字として当たるべき（Task 4 のテスト）
- 桁数の違う並び値（`"999"` と `"1000"`）を文字列のまま比べて順番が逆になる → 数として比べるべき（Task 2 のテスト）
- 既にある投稿をもう一度取り込んだら、フォルダ・非表示・見返し回数が消える → 中身だけ更新し、整理の状態は残すべき（Task 3・Task 8 のテスト）
- 別アプリの JSON や壊れたファイルを読み込んで、データが壊れる → 何も変えずに理由を返すべき（Task 6 のテスト）
- フォルダを消したあと、投稿やルールに消えたフォルダが残る → 投稿から外し、そのフォルダ宛てのルールも消すべき（Task 7 のテスト）

---

## File Structure

| ファイル | 役割 |
|---|---|
| `package.json` / `wxt.config.ts` / `tsconfig.json` / `vitest.config.ts` / `vitest.setup.ts` / `eslint.config.mjs` | 土台の設定 |
| `src/entrypoints/background.ts` | 拡張アイコンを押したら本棚画面を開く（既に開いていればそこへ） |
| `src/entrypoints/dashboard/{index.html,main.tsx,App.tsx,style.css}` | 本棚画面の仮の画面（計画3で作り込む） |
| `src/core/normalize.ts` | 文字の正規化（NFKC＋小文字）、ドメインの取り出し |
| `src/core/types.ts` | データの形（設計書 7 章）と設定の初期値 |
| `src/core/order.ts` | 並べ替えの比較関数（数字の文字列比較、ブクマ順、投稿日順） |
| `src/core/merge.ts` | 取り込み・読み込み時の投稿の合流 |
| `src/core/rules.ts` | ルールの判定と、ルールによるフォルダ付け |
| `src/core/review.ts` | 今日の積みツイ崩しの選び方、日付文字列 |
| `src/core/export-format.ts` | 書き出し JSON の組み立てと、読み込み時の検査 |
| `src/test/factories.ts` | テスト用の投稿を作る関数 |
| `src/db/schema.ts` | Dexie の表定義 |
| `src/db/settings.ts` | 設定の読み書き |
| `src/db/folders.ts` | フォルダの作成・変更・並べ替え・削除 |
| `src/db/posts.ts` | 投稿の保存（合流＋ルール適用）、フォルダの出し入れ、非表示、見返し記録 |
| `src/db/rules-repo.ts` | ルールの保存・削除・未整理への適用 |
| `src/db/review-repo.ts` | 今日の積みツイ崩しの準備と完了記録 |
| `src/db/backup.ts` | 全データの書き出しと、書き出しファイルの読み込み（フォルダの名寄せ） |
| `src/test/db.ts` | テストごとに別の DB を開く関数 |

---

### Task 1: 土台と文字の正規化

**Files:**
- Create: `package.json`, `wxt.config.ts`, `tsconfig.json`, `vitest.config.ts`, `vitest.setup.ts`, `eslint.config.mjs`
- Create: `src/entrypoints/background.ts`, `src/entrypoints/dashboard/index.html`, `src/entrypoints/dashboard/main.tsx`, `src/entrypoints/dashboard/App.tsx`, `src/entrypoints/dashboard/style.css`
- Create: `src/core/normalize.ts`, Test: `src/core/normalize.test.ts`
- Modify: `.gitignore`（`.output/` と `.wxt/` を足す）

**Interfaces:**
- Produces: `normalizeText(s: string): string`、`normalizeDomain(s: string): string`、`domainOf(url: string): string`（`src/core/normalize.ts`）

- [ ] **Step 1: 設定ファイルを書く**

`package.json`:

```json
{
  "name": "twittana",
  "description": "Twitter（現 X）のブックマークをフォルダ整理する Chrome 拡張（非公式）",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "wxt",
    "build": "wxt build",
    "zip": "wxt zip",
    "postinstall": "wxt prepare",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  }
}
```

`wxt.config.ts`:

```ts
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  imports: false,
  modules: ["@wxt-dev/module-react"],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: "ツイッ棚",
    description: "Twitter（現 X）のブックマークを自分のフォルダに整理して見返す（非公式）",
    permissions: ["unlimitedStorage"],
    action: { default_title: "ツイッ棚を開く" },
  },
});
```

`tsconfig.json`:

```json
{
  "extends": "./.wxt/tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

export default defineConfig({
  plugins: [WxtVitest()],
  test: { setupFiles: ["./vitest.setup.ts"] },
});
```

`vitest.setup.ts`:

```ts
import "fake-indexeddb/auto";
```

`eslint.config.mjs`:

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  { ignores: [".output/**", ".wxt/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
];
```

`.gitignore` の末尾に追記:

```
# wxt
.output/
.wxt/
```

- [ ] **Step 2: 依存を入れる**

Run:

```bash
npm install react react-dom dexie
npm install -D wxt @wxt-dev/module-react typescript@^5 @types/react @types/react-dom tailwindcss @tailwindcss/vite vitest fake-indexeddb eslint @eslint/js typescript-eslint
```

Expected: 最後に `wxt prepare` が走り、`.wxt/` ができる。エラーなし。

- [ ] **Step 3: 入口（裏方と仮の本棚画面）を書く**

`src/entrypoints/background.ts`:

```ts
import { browser, defineBackground } from "#imports";

const DASHBOARD_PATH = "/dashboard.html";

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

export default defineBackground(() => {
  browser.action.onClicked.addListener(() => {
    void openDashboard();
  });
});
```

（型チェックで `browser.runtime.ContextType` が無いと言われたら、`contextTypes: ["TAB" as Browser.runtime.ContextType]` に置き換え、`import type { Browser } from "#imports";` を足す）

`src/entrypoints/dashboard/index.html`:

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ツイッ棚</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

`src/entrypoints/dashboard/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/entrypoints/dashboard/App.tsx`:

```tsx
export function App() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">ツイッ棚</h1>
      <p className="mt-2 text-sm text-gray-600">準備中です。</p>
    </main>
  );
}
```

`src/entrypoints/dashboard/style.css`:

```css
@import "tailwindcss";
```

- [ ] **Step 4: 正規化の失敗するテストを書く**

`src/core/normalize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { domainOf, normalizeDomain, normalizeText } from "./normalize";

describe("normalizeText", () => {
  it("全角英数を半角にし、小文字にする", () => {
    expect(normalizeText("ＡＢＣ１２３")).toBe("abc123");
  });
  it("半角カナを全角カナにする", () => {
    expect(normalizeText("ｶﾀｶﾅ")).toBe("カタカナ");
  });
  it("全角の＃を#にする", () => {
    expect(normalizeText("＃推し")).toBe("#推し");
  });
});

describe("normalizeDomain", () => {
  it("URL の形でもドメインだけにする", () => {
    expect(normalizeDomain("https://www.Example.com/path?q=1")).toBe("example.com");
  });
  it("全角や www. を取り除く", () => {
    expect(normalizeDomain("ＷＷＷ.youtube.com")).toBe("youtube.com");
  });
  it("空白だけなら空文字", () => {
    expect(normalizeDomain("  ")).toBe("");
  });
});

describe("domainOf", () => {
  it("URL からドメインを取り出す", () => {
    expect(domainOf("https://www.youtube.com/watch?v=1")).toBe("youtube.com");
  });
  it("URL でなければ空文字", () => {
    expect(domainOf("not a url")).toBe("");
  });
});
```

- [ ] **Step 5: 失敗を確かめる**

Run: `npx vitest run src/core/normalize.test.ts`
Expected: FAIL（`./normalize` が見つからない）

- [ ] **Step 6: 実装する**

`src/core/normalize.ts`:

```ts
/** 比較用に文字をそろえる（全角半角・大文字小文字の違いをなくす） */
export function normalizeText(s: string): string {
  return s.normalize("NFKC").toLowerCase();
}

/** 入力されたドメインや URL を「example.com」の形にそろえる */
export function normalizeDomain(s: string): string {
  return normalizeText(s.trim())
    .replace(/^https?:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/^www\./, "");
}

/** URL のドメインを取り出す。URL でなければ空文字 */
export function domainOf(url: string): string {
  try {
    return normalizeDomain(new URL(url).hostname);
  } catch {
    return "";
  }
}
```

- [ ] **Step 7: すべて通ることを確かめる**

Run: `npm test` → PASS
Run: `npm run typecheck` → エラーなし
Run: `npm run lint` → エラーなし
Run: `npm run build` → `.output/chrome-mv3/manifest.json` ができ、`"permissions": ["unlimitedStorage"]` と `"action"` を含む

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "土台: WXT・React・Tailwind・Vitest・ESLint と文字の正規化" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: データの形と並べ替え

**Files:**
- Create: `src/core/types.ts`, `src/core/order.ts`, `src/test/factories.ts`
- Test: `src/core/order.test.ts`

**Interfaces:**
- Produces（`src/core/types.ts`）: `Author`, `MediaItem`, `LinkItem`, `QuotedPost`, `AssignedBy`, `FolderAssignment`, `CapturedPost`, `Post`, `Folder`, `Condition`, `Rule`, `TodayReview`, `ParseHealth`, `Settings`, `DEFAULT_SETTINGS`
- Produces（`src/core/order.ts`）: `compareNumericStrings(a: string, b: string): number`、`compareByBookmark(a: Post, b: Post): number`（古い順）、`compareByPosted(a: Post, b: Post): number`（古い順）
- Produces（`src/test/factories.ts`）: `makeCaptured(over?: Partial<CapturedPost>): CapturedPost`、`makePost(over?: Partial<Post>): Post`

- [ ] **Step 1: データの形を書く**

`src/core/types.ts`:

```ts
export type Author = { id: string; handle: string; name: string; avatarUrl: string };
export type MediaItem = { type: "photo" | "video" | "gif"; url: string; thumbUrl: string };
export type LinkItem = { url: string; domain: string };
export type QuotedPost = { id: string; authorHandle: string; text: string };
export type AssignedBy = "manual" | "rule" | "ai";
export type FolderAssignment = { folderId: string; by: AssignedBy };

/** X から読み取った投稿の中身（利用者の整理状態は含まない） */
export type CapturedPost = {
  id: string;
  url: string;
  text: string;
  author: Author;
  postedAt: string;
  media: MediaItem[];
  links: LinkItem[];
  hashtags: string[];
  quoted?: QuotedPost;
  /** X のブクマ一覧での並び値（数字の文字列。新しいほど大きい） */
  bookmarkOrder?: string;
  /** ID と URL しか分からなかったとき true */
  partial?: boolean;
};

export type Post = CapturedPost & {
  capturedAt: string;
  folders: FolderAssignment[];
  /** 利用者が手でフォルダを出し入れしたら true。ルール・AI はこの投稿に手を出さない */
  sortedByUser: boolean;
  removedOnX: boolean;
  hidden: boolean;
  aiCheckedFoldersVersion?: number;
  review: { count: number; lastAt?: string };
};

export type Folder = { id: string; name: string; description: string; order: number; createdAt: string };

export type Condition =
  | { kind: "keyword"; value: string }
  | { kind: "author"; handle: string }
  | { kind: "hashtag"; tag: string }
  | { kind: "domain"; domain: string }
  | { kind: "hasMedia"; media: "any" | "photo" | "video" };

export type Rule = { id: string; folderId: string; conditions: Condition[]; enabled: boolean; order: number };

export type TodayReview = { date: string; postIds: string[]; doneIds: string[] };
export type ParseHealth = { lastOkAt?: string; lastErrorAt?: string; lastErrorOp?: string };

export type Settings = {
  pickerOnBookmark: boolean;
  aiEnabled: boolean;
  language: "auto" | "ja" | "en";
  reviewPerDay: number;
  /** フォルダの追加・削除・改名・説明変更で +1。AI の再判定に使う */
  foldersVersion: number;
  todayReview?: TodayReview;
  parseHealth: ParseHealth;
};

export const DEFAULT_SETTINGS: Settings = {
  pickerOnBookmark: true,
  aiEnabled: false,
  language: "auto",
  reviewPerDay: 5,
  foldersVersion: 1,
  parseHealth: {},
};
```

`src/test/factories.ts`:

```ts
import type { CapturedPost, Post } from "../core/types";

export function makeCaptured(over: Partial<CapturedPost> = {}): CapturedPost {
  const id = over.id ?? "1000";
  return {
    id,
    url: `https://x.com/someone/status/${id}`,
    text: "テスト投稿",
    author: { id: "u1", handle: "someone", name: "だれか", avatarUrl: "https://pbs.twimg.com/profile_images/a.jpg" },
    postedAt: "2026-01-01T00:00:00.000Z",
    media: [],
    links: [],
    hashtags: [],
    ...over,
  };
}

export function makePost(over: Partial<Post> = {}): Post {
  return {
    ...makeCaptured(over),
    capturedAt: "2026-02-01T00:00:00.000Z",
    folders: [],
    sortedByUser: false,
    removedOnX: false,
    hidden: false,
    review: { count: 0 },
    ...over,
  };
}
```

- [ ] **Step 2: 並べ替えの失敗するテストを書く**

`src/core/order.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makePost } from "../test/factories";
import { compareByBookmark, compareByPosted, compareNumericStrings } from "./order";

describe("compareNumericStrings", () => {
  it("桁数が違っても数として比べる", () => {
    expect(compareNumericStrings("999", "1000")).toBeLessThan(0);
    expect(compareNumericStrings("1000", "999")).toBeGreaterThan(0);
  });
  it("同じ値なら 0", () => {
    expect(compareNumericStrings("1868000000000000000", "1868000000000000000")).toBe(0);
  });
  it("先頭の 0 は無視する", () => {
    expect(compareNumericStrings("0012", "12")).toBe(0);
  });
});

describe("compareByBookmark", () => {
  it("両方に並び値があれば並び値で古い順", () => {
    const a = makePost({ id: "1", bookmarkOrder: "999" });
    const b = makePost({ id: "2", bookmarkOrder: "1000" });
    expect([b, a].sort(compareByBookmark).map((p) => p.id)).toEqual(["1", "2"]);
  });
  it("並び値が無ければ取り込んだ日時で古い順", () => {
    const a = makePost({ id: "1", capturedAt: "2026-03-02T00:00:00.000Z" });
    const b = makePost({ id: "2", capturedAt: "2026-03-01T00:00:00.000Z" });
    expect([a, b].sort(compareByBookmark).map((p) => p.id)).toEqual(["2", "1"]);
  });
  it("同じなら投稿 ID で古い順", () => {
    const a = makePost({ id: "20" });
    const b = makePost({ id: "3" });
    expect([a, b].sort(compareByBookmark).map((p) => p.id)).toEqual(["3", "20"]);
  });
});

describe("compareByPosted", () => {
  it("投稿日で古い順", () => {
    const a = makePost({ id: "1", postedAt: "2026-05-01T00:00:00.000Z" });
    const b = makePost({ id: "2", postedAt: "2026-04-01T00:00:00.000Z" });
    expect([a, b].sort(compareByPosted).map((p) => p.id)).toEqual(["2", "1"]);
  });
});
```

- [ ] **Step 3: 失敗を確かめる**

Run: `npx vitest run src/core/order.test.ts`
Expected: FAIL（`./order` が見つからない）

- [ ] **Step 4: 実装する**

`src/core/order.ts`:

```ts
import type { Post } from "./types";

/** 数字だけの文字列を、桁数が違っても数として比べる */
export function compareNumericStrings(a: string, b: string): number {
  const x = a.replace(/^0+(?=\d)/, "");
  const y = b.replace(/^0+(?=\d)/, "");
  if (x.length !== y.length) return x.length - y.length;
  return x < y ? -1 : x > y ? 1 : 0;
}

/** ブクマした順（古い順）。並び値が両方にあればそれで、無ければ取り込んだ日時で比べる */
export function compareByBookmark(a: Post, b: Post): number {
  if (a.bookmarkOrder && b.bookmarkOrder) {
    const c = compareNumericStrings(a.bookmarkOrder, b.bookmarkOrder);
    if (c !== 0) return c;
  } else if (a.capturedAt !== b.capturedAt) {
    return a.capturedAt < b.capturedAt ? -1 : 1;
  }
  return compareNumericStrings(a.id, b.id);
}

/** 投稿日の古い順 */
export function compareByPosted(a: Post, b: Post): number {
  if (a.postedAt !== b.postedAt) return a.postedAt < b.postedAt ? -1 : 1;
  return compareNumericStrings(a.id, b.id);
}
```

- [ ] **Step 5: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "中核: データの形と並べ替えの比較関数" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 投稿の合流

**Files:**
- Create: `src/core/merge.ts`, Test: `src/core/merge.test.ts`

**Interfaces:**
- Consumes: `CapturedPost`, `Post`（Task 2）、`makeCaptured`, `makePost`（Task 2）
- Produces: `mergeCaptured(existing: Post | undefined, incoming: CapturedPost, opts: { now: string; bookmarked: boolean }): Post`、`mergeImported(existing: Post | undefined, imported: Post): Post`

- [ ] **Step 1: 失敗するテストを書く**

`src/core/merge.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeCaptured, makePost } from "../test/factories";
import { mergeCaptured, mergeImported } from "./merge";

const NOW = "2026-10-02T12:00:00.000Z";

describe("mergeCaptured", () => {
  it("新しい投稿は、整理の状態を空で作る", () => {
    const p = mergeCaptured(undefined, makeCaptured({ id: "1" }), { now: NOW, bookmarked: true });
    expect(p).toMatchObject({ id: "1", capturedAt: NOW, folders: [], sortedByUser: false, removedOnX: false, hidden: false, review: { count: 0 } });
  });

  it("既にある投稿は中身だけ更新し、整理の状態は残す", () => {
    const existing = makePost({
      id: "1",
      text: "古い本文",
      capturedAt: "2026-01-05T00:00:00.000Z",
      folders: [{ folderId: "f1", by: "manual" }],
      sortedByUser: true,
      hidden: true,
      review: { count: 2, lastAt: "2026-09-01T00:00:00.000Z" },
      aiCheckedFoldersVersion: 3,
    });
    const p = mergeCaptured(existing, makeCaptured({ id: "1", text: "新しい本文" }), { now: NOW, bookmarked: true });
    expect(p.text).toBe("新しい本文");
    expect(p.capturedAt).toBe("2026-01-05T00:00:00.000Z");
    expect(p.folders).toEqual([{ folderId: "f1", by: "manual" }]);
    expect(p.sortedByUser).toBe(true);
    expect(p.hidden).toBe(true);
    expect(p.review).toEqual({ count: 2, lastAt: "2026-09-01T00:00:00.000Z" });
    expect(p.aiCheckedFoldersVersion).toBe(3);
  });

  it("ブクマ済みと分かったら解除済みの印を外す", () => {
    const existing = makePost({ id: "1", removedOnX: true });
    expect(mergeCaptured(existing, makeCaptured({ id: "1" }), { now: NOW, bookmarked: true }).removedOnX).toBe(false);
    expect(mergeCaptured(existing, makeCaptured({ id: "1" }), { now: NOW, bookmarked: false }).removedOnX).toBe(true);
  });

  it("中身の分からない取り込みで、分かっている中身を上書きしない", () => {
    const existing = makePost({ id: "1", text: "本文あり" });
    const p = mergeCaptured(existing, makeCaptured({ id: "1", text: "", partial: true }), { now: NOW, bookmarked: true });
    expect(p.text).toBe("本文あり");
    expect(p.partial).toBeUndefined();
  });

  it("中身の分からなかった投稿は、あとの取り込みで埋まる", () => {
    const existing = makePost({ id: "1", text: "", partial: true });
    const p = mergeCaptured(existing, makeCaptured({ id: "1", text: "本文" }), { now: NOW, bookmarked: true });
    expect(p.text).toBe("本文");
    expect(p.partial).toBeUndefined();
  });

  it("並び値は新しい取り込みに無ければ前の値を残す", () => {
    const existing = makePost({ id: "1", bookmarkOrder: "500" });
    expect(mergeCaptured(existing, makeCaptured({ id: "1" }), { now: NOW, bookmarked: true }).bookmarkOrder).toBe("500");
    expect(mergeCaptured(existing, makeCaptured({ id: "1", bookmarkOrder: "900" }), { now: NOW, bookmarked: true }).bookmarkOrder).toBe("900");
  });
});

describe("mergeImported", () => {
  it("無ければそのまま入れる", () => {
    const imported = makePost({ id: "1" });
    expect(mergeImported(undefined, imported)).toEqual(imported);
  });

  it("フォルダは足し合わせ、非表示や手動の印はどちらかが立っていれば立てる", () => {
    const existing = makePost({ id: "1", folders: [{ folderId: "a", by: "rule" }] });
    const imported = makePost({ id: "1", folders: [{ folderId: "a", by: "manual" }, { folderId: "b", by: "manual" }], hidden: true, sortedByUser: true });
    const p = mergeImported(existing, imported);
    expect(p.folders).toEqual([{ folderId: "a", by: "rule" }, { folderId: "b", by: "manual" }]);
    expect(p.hidden).toBe(true);
    expect(p.sortedByUser).toBe(true);
  });

  it("見返しは多い回数と新しい日時をとる。取り込み日時は古い方をとる", () => {
    const existing = makePost({ id: "1", capturedAt: "2026-05-01T00:00:00.000Z", review: { count: 1, lastAt: "2026-09-01T00:00:00.000Z" } });
    const imported = makePost({ id: "1", capturedAt: "2026-04-01T00:00:00.000Z", review: { count: 3, lastAt: "2026-08-01T00:00:00.000Z" } });
    const p = mergeImported(existing, imported);
    expect(p.review).toEqual({ count: 3, lastAt: "2026-09-01T00:00:00.000Z" });
    expect(p.capturedAt).toBe("2026-04-01T00:00:00.000Z");
  });

  it("手元が中身なしで、読み込んだ方に中身があれば中身を埋める", () => {
    const existing = makePost({ id: "1", text: "", partial: true });
    const p = mergeImported(existing, makePost({ id: "1", text: "本文" }));
    expect(p.text).toBe("本文");
    expect(p.partial).toBeUndefined();
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/core/merge.test.ts`
Expected: FAIL（`./merge` が見つからない）

- [ ] **Step 3: 実装する**

`src/core/merge.ts`:

```ts
import type { CapturedPost, FolderAssignment, Post } from "./types";

/** 投稿の「中身」だけを取り出す（id と並び値と整理の状態は含めない） */
function contentOf(p: CapturedPost) {
  return {
    url: p.url,
    text: p.text,
    author: p.author,
    postedAt: p.postedAt,
    media: p.media,
    links: p.links,
    hashtags: p.hashtags,
    quoted: p.quoted,
    partial: p.partial,
  };
}

/** X から取り込んだ投稿を、既にある投稿に合流する。整理の状態は残す */
export function mergeCaptured(
  existing: Post | undefined,
  incoming: CapturedPost,
  opts: { now: string; bookmarked: boolean },
): Post {
  if (!existing) {
    return {
      ...incoming,
      capturedAt: opts.now,
      folders: [],
      sortedByUser: false,
      removedOnX: false,
      hidden: false,
      review: { count: 0 },
    };
  }
  const source = incoming.partial && !existing.partial ? existing : incoming;
  return {
    ...existing,
    ...contentOf(source),
    bookmarkOrder: incoming.bookmarkOrder ?? existing.bookmarkOrder,
    removedOnX: opts.bookmarked ? false : existing.removedOnX,
  };
}

function laterOf(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/** 書き出しファイルから読み込んだ投稿を、既にある投稿に合流する */
export function mergeImported(existing: Post | undefined, imported: Post): Post {
  if (!existing) return imported;
  const folders: FolderAssignment[] = [...existing.folders];
  for (const f of imported.folders) {
    if (!folders.some((e) => e.folderId === f.folderId)) folders.push(f);
  }
  const source = existing.partial && !imported.partial ? imported : existing;
  return {
    ...existing,
    ...contentOf(source),
    bookmarkOrder: existing.bookmarkOrder ?? imported.bookmarkOrder,
    capturedAt: existing.capturedAt < imported.capturedAt ? existing.capturedAt : imported.capturedAt,
    folders,
    sortedByUser: existing.sortedByUser || imported.sortedByUser,
    hidden: existing.hidden || imported.hidden,
    review: {
      count: Math.max(existing.review.count, imported.review.count),
      lastAt: laterOf(existing.review.lastAt, imported.review.lastAt),
    },
  };
}
```

（`contentOf` が `partial: undefined` を返すと、`toBeUndefined()` のテストは通る。`toEqual` で比べる場合も undefined のキーは無視される）

- [ ] **Step 4: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "中核: 取り込み・読み込み時の投稿の合流" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: ルールの判定

**Files:**
- Create: `src/core/rules.ts`, Test: `src/core/rules.test.ts`

**Interfaces:**
- Consumes: `normalizeText`, `normalizeDomain`（Task 1）、`CapturedPost`, `Post`, `Rule`, `Condition`（Task 2）
- Produces: `matchesCondition(post: CapturedPost, c: Condition): boolean`、`matchesRule(post: CapturedPost, rule: Rule): boolean`、`ruleFolderIds(post: CapturedPost, rules: Rule[]): string[]`、`withRuleFolders(post: Post, rules: Rule[]): Post | null`（変わらなければ null）

- [ ] **Step 1: 失敗するテストを書く**

`src/core/rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeCaptured, makePost } from "../test/factories";
import type { Rule } from "./types";
import { matchesCondition, matchesRule, ruleFolderIds, withRuleFolders } from "./rules";

function rule(over: Partial<Rule>): Rule {
  return { id: "r", folderId: "f", conditions: [], enabled: true, order: 0, ...over };
}

describe("matchesCondition", () => {
  it("キーワードは全角半角・大文字小文字を区別しない", () => {
    const post = makeCaptured({ text: "Unity の ﾁｭｰﾄﾘｱﾙ です" });
    expect(matchesCondition(post, { kind: "keyword", value: "ＵＮＩＴＹ" })).toBe(true);
    expect(matchesCondition(post, { kind: "keyword", value: "チュートリアル" })).toBe(true);
    expect(matchesCondition(post, { kind: "keyword", value: "Unreal" })).toBe(false);
  });
  it("空のキーワードは当てない", () => {
    expect(matchesCondition(makeCaptured(), { kind: "keyword", value: "  " })).toBe(false);
  });
  it("投稿者は @ の有無と大文字小文字を区別しない", () => {
    const post = makeCaptured({ author: { id: "u", handle: "NunuHara", name: "n", avatarUrl: "" } });
    expect(matchesCondition(post, { kind: "author", handle: "@nunuhara" })).toBe(true);
    expect(matchesCondition(post, { kind: "author", handle: "other" })).toBe(false);
  });
  it("ハッシュタグは # や ＃ の有無を区別しない", () => {
    const post = makeCaptured({ hashtags: ["推し活"] });
    expect(matchesCondition(post, { kind: "hashtag", tag: "＃推し活" })).toBe(true);
    expect(matchesCondition(post, { kind: "hashtag", tag: "推し" })).toBe(false);
  });
  it("ドメインはサブドメインにも当たる", () => {
    const post = makeCaptured({ links: [{ url: "https://m.youtube.com/watch?v=1", domain: "m.youtube.com" }] });
    expect(matchesCondition(post, { kind: "domain", domain: "youtube.com" })).toBe(true);
    expect(matchesCondition(post, { kind: "domain", domain: "https://www.youtube.com/" })).toBe(true);
    expect(matchesCondition(post, { kind: "domain", domain: "tube.com" })).toBe(false);
  });
  it("画像・動画あり", () => {
    const photo = makeCaptured({ media: [{ type: "photo", url: "u", thumbUrl: "t" }] });
    const gif = makeCaptured({ media: [{ type: "gif", url: "u", thumbUrl: "t" }] });
    expect(matchesCondition(photo, { kind: "hasMedia", media: "any" })).toBe(true);
    expect(matchesCondition(photo, { kind: "hasMedia", media: "video" })).toBe(false);
    expect(matchesCondition(gif, { kind: "hasMedia", media: "video" })).toBe(true);
    expect(matchesCondition(makeCaptured(), { kind: "hasMedia", media: "any" })).toBe(false);
  });
});

describe("matchesRule", () => {
  const post = makeCaptured({ text: "Unity 講座", hashtags: ["gamedev"] });
  it("条件をすべて満たせば当たる", () => {
    expect(matchesRule(post, rule({ conditions: [{ kind: "keyword", value: "unity" }, { kind: "hashtag", tag: "gamedev" }] }))).toBe(true);
    expect(matchesRule(post, rule({ conditions: [{ kind: "keyword", value: "unity" }, { kind: "hashtag", tag: "art" }] }))).toBe(false);
  });
  it("無効なルールと条件なしのルールは当たらない", () => {
    expect(matchesRule(post, rule({ enabled: false, conditions: [{ kind: "keyword", value: "unity" }] }))).toBe(false);
    expect(matchesRule(post, rule({ conditions: [] }))).toBe(false);
  });
});

describe("ruleFolderIds", () => {
  it("当たったルールのフォルダを順番どおり重複なしで返す", () => {
    const post = makeCaptured({ text: "Unity 講座" });
    const rules = [
      rule({ id: "2", folderId: "b", order: 2, conditions: [{ kind: "keyword", value: "講座" }] }),
      rule({ id: "1", folderId: "a", order: 1, conditions: [{ kind: "keyword", value: "unity" }] }),
      rule({ id: "3", folderId: "a", order: 3, conditions: [{ kind: "keyword", value: "講座" }] }),
    ];
    expect(ruleFolderIds(post, rules)).toEqual(["a", "b"]);
  });
});

describe("withRuleFolders", () => {
  const rules = [rule({ folderId: "a", conditions: [{ kind: "keyword", value: "unity" }] })];
  it("当たったフォルダを by: rule で足す", () => {
    const p = withRuleFolders(makePost({ text: "unity" }), rules);
    expect(p?.folders).toEqual([{ folderId: "a", by: "rule" }]);
  });
  it("利用者が手で整理した投稿には手を出さない", () => {
    expect(withRuleFolders(makePost({ text: "unity", sortedByUser: true }), rules)).toBeNull();
  });
  it("既に入っていれば変えない", () => {
    expect(withRuleFolders(makePost({ text: "unity", folders: [{ folderId: "a", by: "ai" }] }), rules)).toBeNull();
  });
  it("当たらなければ null", () => {
    expect(withRuleFolders(makePost({ text: "ほか" }), rules)).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/core/rules.test.ts`
Expected: FAIL（`./rules` が見つからない）

- [ ] **Step 3: 実装する**

`src/core/rules.ts`:

```ts
import { normalizeDomain, normalizeText } from "./normalize";
import type { CapturedPost, Condition, Post, Rule } from "./types";

function stripPrefix(value: string, prefix: RegExp): string {
  return normalizeText(value.trim()).replace(prefix, "");
}

export function matchesCondition(post: CapturedPost, c: Condition): boolean {
  switch (c.kind) {
    case "keyword": {
      const v = normalizeText(c.value.trim());
      return v !== "" && normalizeText(post.text).includes(v);
    }
    case "author": {
      const v = stripPrefix(c.handle, /^@/);
      return v !== "" && normalizeText(post.author.handle) === v;
    }
    case "hashtag": {
      const v = stripPrefix(c.tag, /^#/);
      return v !== "" && post.hashtags.some((h) => normalizeText(h) === v);
    }
    case "domain": {
      const v = normalizeDomain(c.domain);
      return (
        v !== "" &&
        post.links.some((l) => {
          const d = normalizeDomain(l.domain);
          return d === v || d.endsWith(`.${v}`);
        })
      );
    }
    case "hasMedia":
      if (c.media === "any") return post.media.length > 0;
      if (c.media === "photo") return post.media.some((m) => m.type === "photo");
      return post.media.some((m) => m.type === "video" || m.type === "gif");
  }
}

/** ルールの条件をすべて満たすか。無効なルール・条件なしのルールは当たらない */
export function matchesRule(post: CapturedPost, rule: Rule): boolean {
  return rule.enabled && rule.conditions.length > 0 && rule.conditions.every((c) => matchesCondition(post, c));
}

/** 当たったルールの入れ先フォルダ（ルールの順番どおり・重複なし） */
export function ruleFolderIds(post: CapturedPost, rules: Rule[]): string[] {
  const ids: string[] = [];
  for (const r of [...rules].sort((a, b) => a.order - b.order)) {
    if (matchesRule(post, r) && !ids.includes(r.folderId)) ids.push(r.folderId);
  }
  return ids;
}

/** ルールで当たったフォルダを足した投稿を返す。手で整理した投稿や、変化がなければ null */
export function withRuleFolders(post: Post, rules: Rule[]): Post | null {
  if (post.sortedByUser) return null;
  const add = ruleFolderIds(post, rules).filter((id) => !post.folders.some((f) => f.folderId === id));
  if (add.length === 0) return null;
  return { ...post, folders: [...post.folders, ...add.map((folderId) => ({ folderId, by: "rule" as const }))] };
}
```

- [ ] **Step 4: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "中核: ルールの判定とフォルダ付け" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 今日の積みツイ崩しの選び方

**Files:**
- Create: `src/core/review.ts`, Test: `src/core/review.test.ts`

**Interfaces:**
- Consumes: `compareByBookmark`, `compareNumericStrings`（Task 2）、`Post`, `TodayReview`（Task 2）
- Produces: `REVIEW_POOL_SIZE = 50`、`seededShuffle<T>(items: T[], seed: string): T[]`、`pickTodayReview(posts: Post[], count: number, date: string): string[]`、`remainingReviewIds(t: TodayReview | undefined): string[]`、`localDateString(d: Date): string`

- [ ] **Step 1: 失敗するテストを書く**

`src/core/review.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makePost } from "../test/factories";
import { localDateString, pickTodayReview, remainingReviewIds, seededShuffle } from "./review";

function many(n: number) {
  return Array.from({ length: n }, (_, i) => makePost({ id: String(i + 1), bookmarkOrder: String(1000 + i) }));
}

describe("seededShuffle", () => {
  it("同じ種なら同じ並び、違う種なら（たいてい）違う並び", () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    expect(seededShuffle(items, "2026-10-02")).toEqual(seededShuffle(items, "2026-10-02"));
    expect(seededShuffle(items, "2026-10-02")).not.toEqual(seededShuffle(items, "2026-10-03"));
  });
  it("元の配列を変えない", () => {
    const items = [1, 2, 3];
    seededShuffle(items, "x");
    expect(items).toEqual([1, 2, 3]);
  });
});

describe("pickTodayReview", () => {
  it("同じ日なら同じ顔ぶれ", () => {
    const posts = many(80);
    expect(pickTodayReview(posts, 5, "2026-10-02")).toEqual(pickTodayReview(posts, 5, "2026-10-02"));
  });
  it("見返していない投稿のうち、古い 50 件の中から選ぶ", () => {
    const picked = pickTodayReview(many(80), 5, "2026-10-02");
    expect(picked).toHaveLength(5);
    for (const id of picked) expect(Number(id)).toBeLessThanOrEqual(50);
  });
  it("非表示は選ばない", () => {
    const posts = [makePost({ id: "1", hidden: true }), makePost({ id: "2" })];
    expect(pickTodayReview(posts, 5, "2026-10-02")).toEqual(["2"]);
  });
  it("足りなければ、見返したのが前のものから足す", () => {
    const posts = [
      makePost({ id: "1" }),
      makePost({ id: "2", review: { count: 1, lastAt: "2026-09-10T00:00:00.000Z" } }),
      makePost({ id: "3", review: { count: 4, lastAt: "2026-08-01T00:00:00.000Z" } }),
    ];
    expect(pickTodayReview(posts, 3, "2026-10-02")).toEqual(["1", "3", "2"]);
  });
  it("0 件指定なら空", () => {
    expect(pickTodayReview(many(3), 0, "2026-10-02")).toEqual([]);
  });
});

describe("remainingReviewIds", () => {
  it("済みを除いた残り", () => {
    expect(remainingReviewIds({ date: "d", postIds: ["1", "2", "3"], doneIds: ["2"] })).toEqual(["1", "3"]);
    expect(remainingReviewIds(undefined)).toEqual([]);
  });
});

describe("localDateString", () => {
  it("その環境の日付で YYYY-MM-DD", () => {
    expect(localDateString(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/core/review.test.ts`
Expected: FAIL（`./review` が見つからない）

- [ ] **Step 3: 実装する**

`src/core/review.ts`:

```ts
import { compareByBookmark, compareNumericStrings } from "./order";
import type { Post, TodayReview } from "./types";

export const REVIEW_POOL_SIZE = 50;

function hashString(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** 種から決まる乱数（mulberry32） */
function seededRandom(seed: string): () => number {
  let a = hashString(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 種から決まる並べ替え（元の配列は変えない） */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const arr = [...items];
  const rnd = seededRandom(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 今日見返す投稿の ID を選ぶ。同じ日付なら同じ結果 */
export function pickTodayReview(posts: Post[], count: number, date: string): string[] {
  if (count <= 0) return [];
  const visible = posts.filter((p) => !p.hidden);
  const pool = visible
    .filter((p) => p.review.count === 0)
    .sort(compareByBookmark)
    .slice(0, REVIEW_POOL_SIZE);
  const picked = seededShuffle(pool, date)
    .slice(0, count)
    .map((p) => p.id);
  if (picked.length < count) {
    const reviewed = visible
      .filter((p) => p.review.count > 0)
      .sort((a, b) => (a.review.lastAt ?? "").localeCompare(b.review.lastAt ?? "") || compareNumericStrings(a.id, b.id));
    for (const p of reviewed) {
      if (picked.length >= count) break;
      picked.push(p.id);
    }
  }
  return picked;
}

export function remainingReviewIds(t: TodayReview | undefined): string[] {
  return t ? t.postIds.filter((id) => !t.doneIds.includes(id)) : [];
}

/** その環境のタイムゾーンでの日付 YYYY-MM-DD */
export function localDateString(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
```

- [ ] **Step 4: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "中核: 今日の積みツイ崩しの選び方" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 書き出しと読み込みの形式

**Files:**
- Create: `src/core/export-format.ts`, Test: `src/core/export-format.test.ts`

**Interfaces:**
- Consumes: `Folder`, `Rule`, `Post`（Task 2）
- Produces: `EXPORT_APP = "twittana"`、`EXPORT_SCHEMA_VERSION = 1`、`type ExportFile`、`type ImportError = "not-json" | "wrong-app" | "unsupported-version" | "invalid-shape"`、`buildExport(data: { folders: Folder[]; rules: Rule[]; posts: Post[] }, now: string): ExportFile`、`parseImport(text: string): { ok: true; file: ExportFile } | { ok: false; error: ImportError }`

- [ ] **Step 1: 失敗するテストを書く**

`src/core/export-format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makePost } from "../test/factories";
import { buildExport, parseImport } from "./export-format";
import type { Folder, Rule } from "./types";

const folder: Folder = { id: "f1", name: "ゲーム開発", description: "", order: 0, createdAt: "2026-10-01T00:00:00.000Z" };
const rule: Rule = { id: "r1", folderId: "f1", conditions: [{ kind: "keyword", value: "unity" }], enabled: true, order: 0 };

describe("buildExport → parseImport", () => {
  it("書き出したものはそのまま読み込める", () => {
    const file = buildExport({ folders: [folder], rules: [rule], posts: [makePost({ id: "1" })] }, "2026-10-02T00:00:00.000Z");
    expect(file).toMatchObject({ app: "twittana", schemaVersion: 1, exportedAt: "2026-10-02T00:00:00.000Z" });
    const result = parseImport(JSON.stringify(file));
    expect(result).toEqual({ ok: true, file });
  });
});

describe("parseImport の失敗", () => {
  it("JSON でない", () => {
    expect(parseImport("{壊れた")).toEqual({ ok: false, error: "not-json" });
  });
  it("別のアプリのファイル", () => {
    expect(parseImport(JSON.stringify({ app: "other", schemaVersion: 1, folders: [], rules: [], posts: [] }))).toEqual({ ok: false, error: "wrong-app" });
  });
  it("未対応の版", () => {
    expect(parseImport(JSON.stringify({ app: "twittana", schemaVersion: 99, exportedAt: "x", folders: [], rules: [], posts: [] }))).toEqual({ ok: false, error: "unsupported-version" });
  });
  it("形が違う（投稿に本文が無い）", () => {
    const bad = { app: "twittana", schemaVersion: 1, exportedAt: "x", folders: [], rules: [], posts: [{ id: "1" }] };
    expect(parseImport(JSON.stringify(bad))).toEqual({ ok: false, error: "invalid-shape" });
  });
  it("形が違う（ルールの条件の種類が不明）", () => {
    const bad = { app: "twittana", schemaVersion: 1, exportedAt: "x", folders: [folder], rules: [{ ...rule, conditions: [{ kind: "magic" }] }], posts: [] };
    expect(parseImport(JSON.stringify(bad))).toEqual({ ok: false, error: "invalid-shape" });
  });
  it("配列でない", () => {
    expect(parseImport(JSON.stringify({ app: "twittana", schemaVersion: 1, exportedAt: "x", folders: {}, rules: [], posts: [] }))).toEqual({ ok: false, error: "invalid-shape" });
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/core/export-format.test.ts`
Expected: FAIL（`./export-format` が見つからない）

- [ ] **Step 3: 実装する**

`src/core/export-format.ts`:

```ts
import type { Folder, Post, Rule } from "./types";

export const EXPORT_APP = "twittana";
export const EXPORT_SCHEMA_VERSION = 1;

export type ExportFile = {
  app: typeof EXPORT_APP;
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  folders: Folder[];
  rules: Rule[];
  posts: Post[];
};

export type ImportError = "not-json" | "wrong-app" | "unsupported-version" | "invalid-shape";

export function buildExport(data: { folders: Folder[]; rules: Rule[]; posts: Post[] }, now: string): ExportFile {
  return { app: EXPORT_APP, schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: now, ...data };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === "boolean";

const ASSIGNED_BY = ["manual", "rule", "ai"];
const MEDIA = ["any", "photo", "video"];

function isCondition(v: unknown): boolean {
  if (!isObj(v)) return false;
  switch (v.kind) {
    case "keyword":
      return isStr(v.value);
    case "author":
      return isStr(v.handle);
    case "hashtag":
      return isStr(v.tag);
    case "domain":
      return isStr(v.domain);
    case "hasMedia":
      return MEDIA.includes(v.media as string);
    default:
      return false;
  }
}

function isFolder(v: unknown): boolean {
  return isObj(v) && isStr(v.id) && isStr(v.name) && isStr(v.description) && isNum(v.order) && isStr(v.createdAt);
}

function isRule(v: unknown): boolean {
  return (
    isObj(v) &&
    isStr(v.id) &&
    isStr(v.folderId) &&
    Array.isArray(v.conditions) &&
    v.conditions.every(isCondition) &&
    isBool(v.enabled) &&
    isNum(v.order)
  );
}

function isPost(v: unknown): boolean {
  if (!isObj(v)) return false;
  const a = v.author;
  const r = v.review;
  return (
    isStr(v.id) &&
    isStr(v.url) &&
    isStr(v.text) &&
    isStr(v.postedAt) &&
    isStr(v.capturedAt) &&
    isObj(a) &&
    isStr(a.id) &&
    isStr(a.handle) &&
    isStr(a.name) &&
    isStr(a.avatarUrl) &&
    Array.isArray(v.media) &&
    Array.isArray(v.links) &&
    Array.isArray(v.hashtags) &&
    v.hashtags.every(isStr) &&
    Array.isArray(v.folders) &&
    v.folders.every((f) => isObj(f) && isStr(f.folderId) && ASSIGNED_BY.includes(f.by as string)) &&
    isBool(v.sortedByUser) &&
    isBool(v.removedOnX) &&
    isBool(v.hidden) &&
    isObj(r) &&
    isNum(r.count)
  );
}

/** 書き出しファイルの文字列を検査して読み込む。だめなら理由を返す */
export function parseImport(text: string): { ok: true; file: ExportFile } | { ok: false; error: ImportError } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "not-json" };
  }
  if (!isObj(data) || data.app !== EXPORT_APP) return { ok: false, error: "wrong-app" };
  if (data.schemaVersion !== EXPORT_SCHEMA_VERSION) return { ok: false, error: "unsupported-version" };
  const { folders, rules, posts } = data;
  if (
    !isStr(data.exportedAt) ||
    !Array.isArray(folders) ||
    !Array.isArray(rules) ||
    !Array.isArray(posts) ||
    !folders.every(isFolder) ||
    !rules.every(isRule) ||
    !posts.every(isPost)
  ) {
    return { ok: false, error: "invalid-shape" };
  }
  return { ok: true, file: data as unknown as ExportFile };
}
```

- [ ] **Step 4: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "中核: 書き出し・読み込みの形式と検査" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 保存の土台（表・設定・フォルダ）

**Files:**
- Create: `src/db/schema.ts`, `src/db/settings.ts`, `src/db/folders.ts`, `src/test/db.ts`
- Test: `src/db/settings.test.ts`, `src/db/folders.test.ts`

**Interfaces:**
- Consumes: `Folder`, `Post`, `Rule`, `Settings`, `DEFAULT_SETTINGS`（Task 2）、`normalizeText`（Task 1）
- Produces（`schema.ts`）: `class TwitTanaDB extends Dexie`（表 `posts` / `folders` / `rules` / `kv`）、`getDb(): TwitTanaDB`
- Produces（`settings.ts`）: `getSettings(db): Promise<Settings>`、`updateSettings(db, patch: Partial<Settings>): Promise<Settings>`、`bumpFoldersVersion(db): Promise<number>`
- Produces（`folders.ts`）: `class FolderNameError extends Error { code: "empty" | "duplicate" }`、`listFolders(db): Promise<Folder[]>`、`createFolder(db, input: { name: string; description?: string }, now: string): Promise<Folder>`、`updateFolder(db, id: string, patch: { name?: string; description?: string }): Promise<Folder>`、`reorderFolders(db, idsInOrder: string[]): Promise<void>`、`deleteFolder(db, id: string): Promise<void>`
- Produces（`src/test/db.ts`）: `openTestDb(): TwitTanaDB`（テストごとの別 DB）

- [ ] **Step 1: 表定義とテスト用 DB を書く**

`src/db/schema.ts`:

```ts
import Dexie, { type EntityTable } from "dexie";
import type { Folder, Post, Rule } from "../core/types";

export type KvRow = { key: string; value: unknown };

export class TwitTanaDB extends Dexie {
  posts!: EntityTable<Post, "id">;
  folders!: EntityTable<Folder, "id">;
  rules!: EntityTable<Rule, "id">;
  kv!: EntityTable<KvRow, "key">;

  constructor(name = "twittana") {
    super(name);
    this.version(1).stores({
      posts: "id, capturedAt, postedAt",
      folders: "id, order",
      rules: "id, folderId",
      kv: "key",
    });
  }
}

let shared: TwitTanaDB | undefined;

/** 拡張全体で共有する DB */
export function getDb(): TwitTanaDB {
  shared ??= new TwitTanaDB();
  return shared;
}
```

`src/test/db.ts`:

```ts
import { TwitTanaDB } from "../db/schema";

/** テストごとに名前の違う DB を開く（fake-indexeddb 上） */
export function openTestDb(): TwitTanaDB {
  return new TwitTanaDB(`test-${crypto.randomUUID()}`);
}
```

- [ ] **Step 2: 設定とフォルダの失敗するテストを書く**

`src/db/settings.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../core/types";
import { openTestDb } from "../test/db";
import { bumpFoldersVersion, getSettings, updateSettings } from "./settings";

const db = openTestDb();
afterEach(async () => {
  await db.kv.clear();
});

describe("settings", () => {
  it("保存が無ければ初期値", async () => {
    expect(await getSettings(db)).toEqual(DEFAULT_SETTINGS);
  });
  it("一部だけ変えられる", async () => {
    await updateSettings(db, { reviewPerDay: 10 });
    expect(await getSettings(db)).toEqual({ ...DEFAULT_SETTINGS, reviewPerDay: 10 });
  });
  it("フォルダの版を 1 つ上げる", async () => {
    expect(await bumpFoldersVersion(db)).toBe(DEFAULT_SETTINGS.foldersVersion + 1);
    expect((await getSettings(db)).foldersVersion).toBe(DEFAULT_SETTINGS.foldersVersion + 1);
  });
});
```

`src/db/folders.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { makePost } from "../test/factories";
import { openTestDb } from "../test/db";
import { createFolder, deleteFolder, FolderNameError, listFolders, reorderFolders, updateFolder } from "./folders";
import { getSettings } from "./settings";

const NOW = "2026-10-02T00:00:00.000Z";
const db = openTestDb();
afterEach(async () => {
  await Promise.all([db.folders.clear(), db.posts.clear(), db.rules.clear(), db.kv.clear()]);
});

describe("createFolder", () => {
  it("名前の前後の空白を除き、並び順を末尾にする", async () => {
    const a = await createFolder(db, { name: " ゲーム " }, NOW);
    const b = await createFolder(db, { name: "料理", description: "レシピ" }, NOW);
    expect(a).toMatchObject({ name: "ゲーム", description: "", order: 0, createdAt: NOW });
    expect(b).toMatchObject({ name: "料理", description: "レシピ", order: 1 });
    expect((await listFolders(db)).map((f) => f.name)).toEqual(["ゲーム", "料理"]);
  });
  it("空の名前と、全角半角だけ違う同じ名前は断る", async () => {
    await createFolder(db, { name: "Unity" }, NOW);
    await expect(createFolder(db, { name: "  " }, NOW)).rejects.toMatchObject({ code: "empty" });
    await expect(createFolder(db, { name: "ＵＮＩＴＹ" }, NOW)).rejects.toBeInstanceOf(FolderNameError);
  });
  it("作るとフォルダの版が上がる", async () => {
    const before = (await getSettings(db)).foldersVersion;
    await createFolder(db, { name: "A" }, NOW);
    expect((await getSettings(db)).foldersVersion).toBe(before + 1);
  });
});

describe("updateFolder", () => {
  it("名前と説明を変え、版を上げる。自分と同じ名前はそのままでよい", async () => {
    const f = await createFolder(db, { name: "A" }, NOW);
    const before = (await getSettings(db)).foldersVersion;
    const g = await updateFolder(db, f.id, { name: "A", description: "説明" });
    expect(g).toMatchObject({ name: "A", description: "説明" });
    expect((await getSettings(db)).foldersVersion).toBe(before + 1);
  });
});

describe("reorderFolders", () => {
  it("渡した順に並べ替える", async () => {
    const a = await createFolder(db, { name: "A" }, NOW);
    const b = await createFolder(db, { name: "B" }, NOW);
    await reorderFolders(db, [b.id, a.id]);
    expect((await listFolders(db)).map((f) => f.name)).toEqual(["B", "A"]);
  });
});

describe("deleteFolder", () => {
  it("投稿から外し、そのフォルダ宛てのルールも消す", async () => {
    const a = await createFolder(db, { name: "A" }, NOW);
    const b = await createFolder(db, { name: "B" }, NOW);
    await db.posts.bulkPut([
      makePost({ id: "1", folders: [{ folderId: a.id, by: "manual" }, { folderId: b.id, by: "rule" }] }),
      makePost({ id: "2", folders: [{ folderId: a.id, by: "ai" }] }),
    ]);
    await db.rules.bulkPut([
      { id: "r1", folderId: a.id, conditions: [{ kind: "keyword", value: "x" }], enabled: true, order: 0 },
      { id: "r2", folderId: b.id, conditions: [{ kind: "keyword", value: "y" }], enabled: true, order: 1 },
    ]);
    await deleteFolder(db, a.id);
    expect((await db.posts.get("1"))?.folders).toEqual([{ folderId: b.id, by: "rule" }]);
    expect((await db.posts.get("2"))?.folders).toEqual([]);
    expect((await db.rules.toArray()).map((r) => r.id)).toEqual(["r2"]);
    expect((await listFolders(db)).map((f) => f.name)).toEqual(["B"]);
  });
});
```

- [ ] **Step 3: 失敗を確かめる**

Run: `npx vitest run src/db`
Expected: FAIL（`./settings` と `./folders` が見つからない）

- [ ] **Step 4: 実装する**

`src/db/settings.ts`:

```ts
import { DEFAULT_SETTINGS, type Settings } from "../core/types";
import type { TwitTanaDB } from "./schema";

const KEY = "settings";

export async function getSettings(db: TwitTanaDB): Promise<Settings> {
  const row = await db.kv.get(KEY);
  return { ...DEFAULT_SETTINGS, ...(row?.value as Partial<Settings> | undefined) };
}

export async function updateSettings(db: TwitTanaDB, patch: Partial<Settings>): Promise<Settings> {
  return db.transaction("rw", db.kv, async () => {
    const next = { ...(await getSettings(db)), ...patch };
    await db.kv.put({ key: KEY, value: next });
    return next;
  });
}

/** フォルダの構成が変わったことを記録する（AI の再判定用） */
export async function bumpFoldersVersion(db: TwitTanaDB): Promise<number> {
  return db.transaction("rw", db.kv, async () => {
    const v = (await getSettings(db)).foldersVersion + 1;
    await updateSettings(db, { foldersVersion: v });
    return v;
  });
}
```

`src/db/folders.ts`:

```ts
import { normalizeText } from "../core/normalize";
import type { Folder } from "../core/types";
import type { TwitTanaDB } from "./schema";
import { bumpFoldersVersion } from "./settings";

export class FolderNameError extends Error {
  constructor(readonly code: "empty" | "duplicate") {
    super(code);
    this.name = "FolderNameError";
  }
}

async function checkName(db: TwitTanaDB, name: string, exceptId?: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new FolderNameError("empty");
  const key = normalizeText(trimmed);
  const all = await db.folders.toArray();
  if (all.some((f) => f.id !== exceptId && normalizeText(f.name) === key)) throw new FolderNameError("duplicate");
  return trimmed;
}

export async function listFolders(db: TwitTanaDB): Promise<Folder[]> {
  return db.folders.orderBy("order").toArray();
}

export async function createFolder(
  db: TwitTanaDB,
  input: { name: string; description?: string },
  now: string,
): Promise<Folder> {
  return db.transaction("rw", [db.folders, db.kv], async () => {
    const name = await checkName(db, input.name);
    const last = await db.folders.orderBy("order").last();
    const folder: Folder = {
      id: crypto.randomUUID(),
      name,
      description: input.description?.trim() ?? "",
      order: (last?.order ?? -1) + 1,
      createdAt: now,
    };
    await db.folders.add(folder);
    await bumpFoldersVersion(db);
    return folder;
  });
}

export async function updateFolder(
  db: TwitTanaDB,
  id: string,
  patch: { name?: string; description?: string },
): Promise<Folder> {
  return db.transaction("rw", [db.folders, db.kv], async () => {
    const current = await db.folders.get(id);
    if (!current) throw new Error(`folder not found: ${id}`);
    const next: Folder = {
      ...current,
      name: patch.name === undefined ? current.name : await checkName(db, patch.name, id),
      description: patch.description === undefined ? current.description : patch.description.trim(),
    };
    await db.folders.put(next);
    await bumpFoldersVersion(db);
    return next;
  });
}

export async function reorderFolders(db: TwitTanaDB, idsInOrder: string[]): Promise<void> {
  await db.transaction("rw", db.folders, async () => {
    await Promise.all(idsInOrder.map((id, order) => db.folders.update(id, { order })));
  });
}

/** フォルダを消す。投稿から外し、そのフォルダ宛てのルールも消す */
export async function deleteFolder(db: TwitTanaDB, id: string): Promise<void> {
  await db.transaction("rw", [db.folders, db.posts, db.rules, db.kv], async () => {
    await db.folders.delete(id);
    await db.rules.where("folderId").equals(id).delete();
    await db.posts.toCollection().modify((p) => {
      if (p.folders.some((f) => f.folderId === id)) p.folders = p.folders.filter((f) => f.folderId !== id);
    });
    await bumpFoldersVersion(db);
  });
}
```

- [ ] **Step 5: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "保存: 表定義・設定・フォルダの操作" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: 投稿とルールの保存

**Files:**
- Create: `src/db/posts.ts`, `src/db/rules-repo.ts`
- Test: `src/db/posts.test.ts`, `src/db/rules-repo.test.ts`

**Interfaces:**
- Consumes: `mergeCaptured`（Task 3）、`withRuleFolders`（Task 4）、`TwitTanaDB`（Task 7）、`CapturedPost`, `Post`, `Rule`（Task 2）
- Produces（`posts.ts`）: `saveCaptured(db, items: CapturedPost[], opts: { now: string; bookmarked: boolean }): Promise<Post[]>`、`markRemovedOnX(db, postId: string): Promise<void>`、`addToFolder(db, postIds: string[], folderId: string): Promise<void>`、`removeFromFolder(db, postIds: string[], folderId: string): Promise<void>`、`setHidden(db, postIds: string[], hidden: boolean): Promise<void>`、`markReviewed(db, postId: string, now: string): Promise<void>`、`listPosts(db): Promise<Post[]>`
- Produces（`rules-repo.ts`）: `listRules(db): Promise<Rule[]>`、`saveRule(db, input: { id?: string; folderId: string; conditions: Rule["conditions"]; enabled: boolean }): Promise<Rule>`、`deleteRule(db, id: string): Promise<void>`、`applyRulesToUnsorted(db): Promise<number>`

- [ ] **Step 1: 失敗するテストを書く**

`src/db/posts.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { makeCaptured, makePost } from "../test/factories";
import { openTestDb } from "../test/db";
import { addToFolder, markRemovedOnX, markReviewed, removeFromFolder, saveCaptured, setHidden } from "./posts";

const NOW = "2026-10-02T00:00:00.000Z";
const db = openTestDb();
afterEach(async () => {
  await Promise.all([db.posts.clear(), db.rules.clear()]);
});

describe("saveCaptured", () => {
  it("新しい投稿を保存し、ルールを当てる", async () => {
    await db.rules.put({ id: "r", folderId: "f", conditions: [{ kind: "keyword", value: "unity" }], enabled: true, order: 0 });
    const [p] = await saveCaptured(db, [makeCaptured({ id: "1", text: "Unity 講座" })], { now: NOW, bookmarked: true });
    expect(p.folders).toEqual([{ folderId: "f", by: "rule" }]);
    expect(await db.posts.get("1")).toEqual(p);
  });
  it("既にある投稿の整理の状態を消さない", async () => {
    await db.posts.put(makePost({ id: "1", text: "古い", folders: [{ folderId: "a", by: "manual" }], sortedByUser: true, hidden: true, review: { count: 3 } }));
    await saveCaptured(db, [makeCaptured({ id: "1", text: "新しい" })], { now: NOW, bookmarked: true });
    expect(await db.posts.get("1")).toMatchObject({ text: "新しい", folders: [{ folderId: "a", by: "manual" }], sortedByUser: true, hidden: true, review: { count: 3 } });
  });
  it("1 回の保存に同じ投稿が 2 回あっても、中身のある方を残す", async () => {
    await saveCaptured(db, [makeCaptured({ id: "1", text: "本文" }), makeCaptured({ id: "1", text: "", partial: true })], { now: NOW, bookmarked: true });
    expect((await db.posts.get("1"))?.text).toBe("本文");
  });
  it("空なら何もしない", async () => {
    expect(await saveCaptured(db, [], { now: NOW, bookmarked: true })).toEqual([]);
  });
});

describe("フォルダの出し入れ", () => {
  it("手で入れると by: manual になり、手で整理した印が立つ", async () => {
    await db.posts.put(makePost({ id: "1", folders: [{ folderId: "a", by: "rule" }] }));
    await addToFolder(db, ["1"], "a");
    await addToFolder(db, ["1"], "b");
    expect(await db.posts.get("1")).toMatchObject({
      folders: [{ folderId: "a", by: "manual" }, { folderId: "b", by: "manual" }],
      sortedByUser: true,
    });
  });
  it("手で外しても手で整理した印が立つ", async () => {
    await db.posts.put(makePost({ id: "1", folders: [{ folderId: "a", by: "rule" }] }));
    await removeFromFolder(db, ["1"], "a");
    expect(await db.posts.get("1")).toMatchObject({ folders: [], sortedByUser: true });
  });
});

describe("そのほかの印", () => {
  it("解除済み・非表示・見返しの記録", async () => {
    await db.posts.put(makePost({ id: "1" }));
    await markRemovedOnX(db, "1");
    await setHidden(db, ["1"], true);
    await markReviewed(db, "1", NOW);
    await markReviewed(db, "1", NOW);
    expect(await db.posts.get("1")).toMatchObject({ removedOnX: true, hidden: true, review: { count: 2, lastAt: NOW } });
  });
  it("無い投稿への操作はエラーにしない", async () => {
    await expect(markRemovedOnX(db, "nothing")).resolves.toBeUndefined();
  });
});
```

`src/db/rules-repo.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { makePost } from "../test/factories";
import { openTestDb } from "../test/db";
import { createFolder } from "./folders";
import { applyRulesToUnsorted, deleteRule, listRules, saveRule } from "./rules-repo";

const NOW = "2026-10-02T00:00:00.000Z";
const db = openTestDb();
afterEach(async () => {
  await Promise.all([db.posts.clear(), db.rules.clear(), db.folders.clear(), db.kv.clear()]);
});

describe("saveRule / listRules / deleteRule", () => {
  it("新しいルールは末尾に、既存は並び順を保って更新", async () => {
    const f = await createFolder(db, { name: "A" }, NOW);
    const r1 = await saveRule(db, { folderId: f.id, conditions: [{ kind: "keyword", value: "x" }], enabled: true });
    const r2 = await saveRule(db, { folderId: f.id, conditions: [{ kind: "keyword", value: "y" }], enabled: true });
    await saveRule(db, { id: r1.id, folderId: f.id, conditions: [{ kind: "keyword", value: "z" }], enabled: false });
    const rules = await listRules(db);
    expect(rules.map((r) => [r.id, r.order, r.enabled])).toEqual([
      [r1.id, 0, false],
      [r2.id, 1, true],
    ]);
    await deleteRule(db, r1.id);
    expect((await listRules(db)).map((r) => r.id)).toEqual([r2.id]);
  });
  it("無いフォルダ宛てのルールは断る", async () => {
    await expect(saveRule(db, { folderId: "nothing", conditions: [], enabled: true })).rejects.toThrow("folder not found");
  });
});

describe("applyRulesToUnsorted", () => {
  it("未整理で、手で整理していない投稿にだけ当てて、変わった件数を返す", async () => {
    const f = await createFolder(db, { name: "A" }, NOW);
    await saveRule(db, { folderId: f.id, conditions: [{ kind: "keyword", value: "unity" }], enabled: true });
    await db.posts.bulkPut([
      makePost({ id: "1", text: "unity" }),
      makePost({ id: "2", text: "unity", sortedByUser: true }),
      makePost({ id: "3", text: "unity", folders: [{ folderId: "other", by: "ai" }] }),
      makePost({ id: "4", text: "ほか" }),
    ]);
    expect(await applyRulesToUnsorted(db)).toBe(1);
    expect((await db.posts.get("1"))?.folders).toEqual([{ folderId: f.id, by: "rule" }]);
    expect((await db.posts.get("2"))?.folders).toEqual([]);
    expect((await db.posts.get("3"))?.folders).toEqual([{ folderId: "other", by: "ai" }]);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/db/posts.test.ts src/db/rules-repo.test.ts`
Expected: FAIL（`./posts` と `./rules-repo` が見つからない）

- [ ] **Step 3: 実装する**

`src/db/posts.ts`:

```ts
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
```

`src/db/rules-repo.ts`:

```ts
import { withRuleFolders } from "../core/rules";
import type { Post, Rule } from "../core/types";
import type { TwitTanaDB } from "./schema";

export async function listRules(db: TwitTanaDB): Promise<Rule[]> {
  return (await db.rules.toArray()).sort((a, b) => a.order - b.order);
}

/** ルールを作る（id なし）か更新する（id あり）。並び順は新規なら末尾、更新なら保つ */
export async function saveRule(
  db: TwitTanaDB,
  input: { id?: string; folderId: string; conditions: Rule["conditions"]; enabled: boolean },
): Promise<Rule> {
  return db.transaction("rw", [db.rules, db.folders], async () => {
    if (!(await db.folders.get(input.folderId))) throw new Error(`folder not found: ${input.folderId}`);
    const current = input.id ? await db.rules.get(input.id) : undefined;
    const all = await db.rules.toArray();
    const order = current?.order ?? all.reduce((max, r) => Math.max(max, r.order), -1) + 1;
    const rule: Rule = {
      id: current?.id ?? crypto.randomUUID(),
      folderId: input.folderId,
      conditions: input.conditions,
      enabled: input.enabled,
      order,
    };
    await db.rules.put(rule);
    return rule;
  });
}

export async function deleteRule(db: TwitTanaDB, id: string): Promise<void> {
  await db.rules.delete(id);
}

/** どのフォルダにも入っておらず、手で整理していない投稿にルールを当てる。変わった件数を返す */
export async function applyRulesToUnsorted(db: TwitTanaDB): Promise<number> {
  return db.transaction("rw", [db.posts, db.rules], async () => {
    const rules = await db.rules.toArray();
    const targets = await db.posts.filter((p) => p.folders.length === 0 && !p.sortedByUser).toArray();
    const changed = targets.map((p) => withRuleFolders(p, rules)).filter((p): p is Post => p !== null);
    await db.posts.bulkPut(changed);
    return changed.length;
  });
}
```

- [ ] **Step 4: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "保存: 投稿の取り込み・フォルダの出し入れ・ルールの保存と適用" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: 今日の積みツイ崩しの保存

**Files:**
- Create: `src/db/review-repo.ts`, Test: `src/db/review-repo.test.ts`

**Interfaces:**
- Consumes: `pickTodayReview`, `remainingReviewIds`（Task 5）、`getSettings`, `updateSettings`（Task 7）、`markReviewed`（Task 8）
- Produces: `ensureTodayReview(db, today: string): Promise<TodayReview>`、`completeReview(db, postId: string, today: string, now: string): Promise<TodayReview>`、`remainingReviewCount(db, today: string): Promise<number>`

- [ ] **Step 1: 失敗するテストを書く**

`src/db/review-repo.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { makePost } from "../test/factories";
import { openTestDb } from "../test/db";
import { completeReview, ensureTodayReview, remainingReviewCount } from "./review-repo";
import { updateSettings } from "./settings";

const db = openTestDb();
afterEach(async () => {
  await Promise.all([db.posts.clear(), db.kv.clear()]);
});

async function seed(n: number) {
  await db.posts.bulkPut(Array.from({ length: n }, (_, i) => makePost({ id: String(i + 1) })));
}

describe("ensureTodayReview", () => {
  it("その日の顔ぶれを作って保存し、同じ日はそれを返す", async () => {
    await seed(10);
    await updateSettings(db, { reviewPerDay: 3 });
    const first = await ensureTodayReview(db, "2026-10-02");
    expect(first.postIds).toHaveLength(3);
    await db.posts.put(makePost({ id: "999" }));
    expect(await ensureTodayReview(db, "2026-10-02")).toEqual(first);
  });
  it("日付が変わったら選び直す", async () => {
    await seed(10);
    const a = await ensureTodayReview(db, "2026-10-02");
    const b = await ensureTodayReview(db, "2026-10-03");
    expect(b.date).toBe("2026-10-03");
    expect(b.doneIds).toEqual([]);
    expect(a.date).toBe("2026-10-02");
  });
});

describe("completeReview", () => {
  it("済みにして見返しを記録し、残り件数が減る", async () => {
    await seed(5);
    await updateSettings(db, { reviewPerDay: 2 });
    const t = await ensureTodayReview(db, "2026-10-02");
    expect(await remainingReviewCount(db, "2026-10-02")).toBe(2);
    await completeReview(db, t.postIds[0], "2026-10-02", "2026-10-02T09:00:00.000Z");
    expect(await remainingReviewCount(db, "2026-10-02")).toBe(1);
    expect((await db.posts.get(t.postIds[0]))?.review).toEqual({ count: 1, lastAt: "2026-10-02T09:00:00.000Z" });
  });
  it("同じ投稿を 2 回済みにしても 1 回だけ数える。今日の顔ぶれ以外は無視", async () => {
    await seed(5);
    const t = await ensureTodayReview(db, "2026-10-02");
    await completeReview(db, t.postIds[0], "2026-10-02", "2026-10-02T09:00:00.000Z");
    await completeReview(db, t.postIds[0], "2026-10-02", "2026-10-02T09:05:00.000Z");
    const after = await completeReview(db, "not-today", "2026-10-02", "2026-10-02T09:10:00.000Z");
    expect(after.doneIds).toEqual([t.postIds[0]]);
    expect((await db.posts.get(t.postIds[0]))?.review.count).toBe(1);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/db/review-repo.test.ts`
Expected: FAIL（`./review-repo` が見つからない）

- [ ] **Step 3: 実装する**

`src/db/review-repo.ts`:

```ts
import { pickTodayReview, remainingReviewIds } from "../core/review";
import type { TodayReview } from "../core/types";
import { markReviewed } from "./posts";
import type { TwitTanaDB } from "./schema";
import { getSettings, updateSettings } from "./settings";

/** 今日の顔ぶれを返す。まだ無いか日付が変わっていれば選び直して保存する */
export async function ensureTodayReview(db: TwitTanaDB, today: string): Promise<TodayReview> {
  return db.transaction("rw", [db.posts, db.kv], async () => {
    const settings = await getSettings(db);
    if (settings.todayReview?.date === today) return settings.todayReview;
    const posts = await db.posts.toArray();
    const next: TodayReview = { date: today, postIds: pickTodayReview(posts, settings.reviewPerDay, today), doneIds: [] };
    await updateSettings(db, { todayReview: next });
    return next;
  });
}

/** 今日の 1 件を済みにする（見た・フォルダへ入れた・もう出さない のどれでも呼ぶ） */
export async function completeReview(db: TwitTanaDB, postId: string, today: string, now: string): Promise<TodayReview> {
  return db.transaction("rw", [db.posts, db.kv], async () => {
    const current = await ensureTodayReview(db, today);
    if (!current.postIds.includes(postId) || current.doneIds.includes(postId)) return current;
    await markReviewed(db, postId, now);
    const next: TodayReview = { ...current, doneIds: [...current.doneIds, postId] };
    await updateSettings(db, { todayReview: next });
    return next;
  });
}

export async function remainingReviewCount(db: TwitTanaDB, today: string): Promise<number> {
  return remainingReviewIds(await ensureTodayReview(db, today)).length;
}
```

- [ ] **Step 4: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし / `npm run build` → 成功

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "保存: 今日の積みツイ崩しの準備と完了記録" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: 書き出しと読み込み（保存側）

**Files:**
- Create: `src/db/backup.ts`, Test: `src/db/backup.test.ts`

**Interfaces:**
- Consumes: `buildExport`, `ExportFile`（Task 6）、`mergeImported`（Task 3）、`normalizeText`（Task 1）、`listFolders`（Task 7）、`listRules`（Task 8）、`bumpFoldersVersion`（Task 7）
- Produces: `exportAll(db, now: string): Promise<ExportFile>`、`type ImportSummary = { posts: number; folders: number; rules: number }`、`importFile(db, file: ExportFile): Promise<ImportSummary>`

- [ ] **Step 1: 失敗するテストを書く**

`src/db/backup.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { buildExport } from "../core/export-format";
import type { Folder, Rule } from "../core/types";
import { makePost } from "../test/factories";
import { openTestDb } from "../test/db";
import { exportAll, importFile } from "./backup";
import { createFolder, listFolders } from "./folders";
import { listRules } from "./rules-repo";
import { getSettings } from "./settings";

const NOW = "2026-10-02T00:00:00.000Z";
const db = openTestDb();
afterEach(async () => {
  await Promise.all([db.posts.clear(), db.rules.clear(), db.folders.clear(), db.kv.clear()]);
});

const folder = (over: Partial<Folder>): Folder => ({ id: "f", name: "A", description: "", order: 0, createdAt: NOW, ...over });
const rule = (over: Partial<Rule>): Rule => ({ id: "r", folderId: "f", conditions: [{ kind: "keyword", value: "x" }], enabled: true, order: 0, ...over });

describe("exportAll → importFile", () => {
  it("空の DB に読み込むと同じ中身になる", async () => {
    const f = await createFolder(db, { name: "ゲーム" }, NOW);
    await db.rules.put(rule({ id: "r1", folderId: f.id }));
    await db.posts.put(makePost({ id: "1", folders: [{ folderId: f.id, by: "manual" }], sortedByUser: true }));
    const file = await exportAll(db, NOW);

    const other = openTestDb();
    const summary = await importFile(other, file);
    expect(summary).toEqual({ posts: 1, folders: 1, rules: 1 });
    expect(await listFolders(other)).toEqual(await listFolders(db));
    expect(await listRules(other)).toEqual(await listRules(db));
    expect(await other.posts.get("1")).toEqual(await db.posts.get("1"));
    await other.delete();
  });
});

describe("importFile", () => {
  it("同じ名前で ID の違うフォルダは手元のフォルダにまとめる", async () => {
    const local = await createFolder(db, { name: "ゲーム" }, NOW);
    const file = buildExport(
      {
        folders: [folder({ id: "imported", name: "ｹﾞｰﾑ" })],
        rules: [rule({ id: "r9", folderId: "imported" })],
        posts: [makePost({ id: "1", folders: [{ folderId: "imported", by: "manual" }] })],
      },
      NOW,
    );
    const summary = await importFile(db, file);
    expect(summary).toEqual({ posts: 1, folders: 0, rules: 1 });
    expect((await listFolders(db)).map((f) => f.id)).toEqual([local.id]);
    expect((await db.posts.get("1"))?.folders).toEqual([{ folderId: local.id, by: "manual" }]);
    expect((await db.rules.get("r9"))?.folderId).toBe(local.id);
  });

  it("既にある投稿とは合流し、手元の整理を残す", async () => {
    const a = await createFolder(db, { name: "A" }, NOW);
    await db.posts.put(makePost({ id: "1", folders: [{ folderId: a.id, by: "manual" }] }));
    const file = buildExport(
      { folders: [folder({ id: "b", name: "B" })], rules: [], posts: [makePost({ id: "1", folders: [{ folderId: "b", by: "rule" }] })] },
      NOW,
    );
    await importFile(db, file);
    expect((await db.posts.get("1"))?.folders).toEqual([
      { folderId: a.id, by: "manual" },
      { folderId: "b", by: "rule" },
    ]);
  });

  it("どこにも無いフォルダ宛てのルールと振り分けは捨てる", async () => {
    const file = buildExport(
      { folders: [], rules: [rule({ id: "r1", folderId: "ghost" })], posts: [makePost({ id: "1", folders: [{ folderId: "ghost", by: "manual" }] })] },
      NOW,
    );
    expect(await importFile(db, file)).toEqual({ posts: 1, folders: 0, rules: 0 });
    expect((await db.posts.get("1"))?.folders).toEqual([]);
  });

  it("フォルダが増えたときだけフォルダの版を上げる", async () => {
    const before = (await getSettings(db)).foldersVersion;
    await importFile(db, buildExport({ folders: [], rules: [], posts: [] }, NOW));
    expect((await getSettings(db)).foldersVersion).toBe(before);
    await importFile(db, buildExport({ folders: [folder({ id: "n", name: "新" })], rules: [], posts: [] }, NOW));
    expect((await getSettings(db)).foldersVersion).toBe(before + 1);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/db/backup.test.ts`
Expected: FAIL（`./backup` が見つからない）

- [ ] **Step 3: 実装する**

`src/db/backup.ts`:

```ts
import { buildExport, type ExportFile } from "../core/export-format";
import { mergeImported } from "../core/merge";
import { normalizeText } from "../core/normalize";
import type { FolderAssignment, Post } from "../core/types";
import { listFolders } from "./folders";
import { listRules } from "./rules-repo";
import type { TwitTanaDB } from "./schema";
import { bumpFoldersVersion } from "./settings";

export type ImportSummary = { posts: number; folders: number; rules: number };

export async function exportAll(db: TwitTanaDB, now: string): Promise<ExportFile> {
  const [folders, rules, posts] = await Promise.all([listFolders(db), listRules(db), db.posts.toArray()]);
  return buildExport({ folders, rules, posts }, now);
}

function uniqueFolders(folders: FolderAssignment[]): FolderAssignment[] {
  const seen = new Set<string>();
  return folders.filter((f) => {
    if (seen.has(f.folderId)) return false;
    seen.add(f.folderId);
    return true;
  });
}

/**
 * 書き出しファイルを読み込む（parseImport で検査済みのもの）。
 * フォルダは ID か名前（全角半角を区別しない）が同じなら手元のものにまとめる。
 * どこにも無いフォルダ宛てのルールと振り分けは捨てる。
 */
export async function importFile(db: TwitTanaDB, file: ExportFile): Promise<ImportSummary> {
  return db.transaction("rw", [db.posts, db.folders, db.rules, db.kv], async () => {
    const localFolders = await db.folders.toArray();
    const idMap = new Map<string, string>();
    let nextFolderOrder = localFolders.reduce((max, f) => Math.max(max, f.order), -1) + 1;
    let addedFolders = 0;
    for (const f of [...file.folders].sort((a, b) => a.order - b.order)) {
      const local =
        localFolders.find((l) => l.id === f.id) ??
        localFolders.find((l) => normalizeText(l.name) === normalizeText(f.name));
      if (local) {
        idMap.set(f.id, local.id);
        continue;
      }
      const created = { ...f, order: nextFolderOrder++ };
      await db.folders.add(created);
      localFolders.push(created);
      idMap.set(f.id, f.id);
      addedFolders++;
    }

    const localRules = await db.rules.toArray();
    let nextRuleOrder = localRules.reduce((max, r) => Math.max(max, r.order), -1) + 1;
    let addedRules = 0;
    for (const r of [...file.rules].sort((a, b) => a.order - b.order)) {
      const folderId = idMap.get(r.folderId);
      if (!folderId || localRules.some((l) => l.id === r.id)) continue;
      await db.rules.add({ ...r, folderId, order: nextRuleOrder++ });
      addedRules++;
    }

    const remapped: Post[] = file.posts.map((p) => ({
      ...p,
      folders: uniqueFolders(
        p.folders.flatMap((f) => {
          const id = idMap.get(f.folderId);
          return id ? [{ ...f, folderId: id }] : [];
        }),
      ),
    }));
    const existing = await db.posts.bulkGet(remapped.map((p) => p.id));
    const merged = remapped.map((p, i) => mergeImported(existing[i], p));
    await db.posts.bulkPut(merged);

    if (addedFolders > 0) await bumpFoldersVersion(db);
    return { posts: merged.length, folders: addedFolders, rules: addedRules };
  });
}
```

- [ ] **Step 4: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし / `npm run build` → 成功

- [ ] **Step 5: task.md を更新して Commit・push**

`task.md` の「今やっていること」を次のようにする:

```markdown
- [x] 計画1：土台と中核（`docs/superpowers/plans/2026-10-02-twittana-a-foundation.md`）
- [ ] 計画2：X からの取り込み（取り込み係・読み取り係・橋渡し係・裏方・フォルダ選択メニュー）
- [ ] 計画3：本棚画面
- [ ] 計画4：AI 分類・言語・公開準備
```

```bash
git add -A
git commit -m "保存: 書き出しと読み込み（フォルダの名寄せつき）" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```
