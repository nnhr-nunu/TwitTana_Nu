# ツイッ棚 計画3：本棚画面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 拡張の専用タブ「本棚画面」を作る。一覧・検索・並べ替え・絞り込み・まとめて操作・今日の積みツイ崩し・フォルダとルールの編集・設定・書き出しと読み込み。

**Architecture:** 本棚画面は拡張のページなので、裏方を通さず Dexie を直接読み書きする。表示は `dexie-react-hooks` の `useLiveQuery` で DB の変化（裏方が取り込んだ投稿を含む）に自動で追従する。絞り込み・検索・並べ替えなど画面に依存しない判断は `src/core/` の純粋関数にする。文言はすべて `src/i18n/` の辞書から `t()` で引く（英語は計画4で足す）。

**Tech Stack:** 計画1・2と同じ ＋ dexie-react-hooks

**Spec:** [`docs/superpowers/specs/2026-10-02-twittana-design.md`](../specs/2026-10-02-twittana-design.md)（9 章の手動・ルール、10 章、11 章、12 章の書き出し・読み込み、13 章の保存失敗・読み込み失敗・フォルダ削除）

**前提:** 計画1・2 が完了していること。使う関数: `listFolders`・`createFolder`・`updateFolder`・`reorderFolders`・`deleteFolder`・`FolderNameError`（`src/db/folders.ts`）、`addToFolder`・`removeFromFolder`・`setHidden`（`src/db/posts.ts`）、`listRules`・`saveRule`・`deleteRule`・`applyRulesToUnsorted`（`src/db/rules-repo.ts`）、`getSettings`・`updateSettings`（`src/db/settings.ts`）、`ensureTodayReview`・`completeReview`（`src/db/review-repo.ts`）、`exportAll`・`importFile`（`src/db/backup.ts`）、`getDb`・`TwitTanaDB`（`src/db/schema.ts`）、`parseImport`・`ImportError`（`src/core/export-format.ts`）、`compareByBookmark`・`compareByPosted`（`src/core/order.ts`）、`remainingReviewIds`・`localDateString`（`src/core/review.ts`）、`normalizeText`（`src/core/normalize.ts`）、`hasParseWarning`（`src/core/health.ts`）、型（`src/core/types.ts`）、`makePost`（`src/test/factories.ts`）、`openTestDb`（`src/test/db.ts`）。

## Global Constraints

- 計画1・2の Global Constraints をすべて守る（tsconfig は `strict`・`noUncheckedIndexedAccess`・`verbatimModuleSyntax`）
- 画面に出す文字は `t()` を通す（直書きしない）。キーは `src/i18n/ja.ts` にあるものだけ
- 本棚画面から外部へ通信しない。画像は X の画像配信（`pbs.twimg.com`）から `<img>` で読むだけ。`<img>` には `referrerPolicy="no-referrer"` と `loading="lazy"` をつける
- X の投稿へのリンクは `target="_blank" rel="noopener noreferrer"`
- DB の操作はすべて `useRun()` を通し、失敗したら画面上部に理由と「書き出しで退避」の案内を出す（設計書 13 章）
- 一覧は 100 件ずつ表示し、「もっと見る」で増やす（1 万件でも重くしない）
- 色は Tailwind の `amber`（明るい本棚）と `stone`（暗い本棚）を使い、`dark:` で暗い配色にも対応する

## Review Focus

- 非表示にした投稿が、すべて・未整理・フォルダの一覧や今日の積みツイ崩しに出てしまう → 「非表示にしたもの」以外には出ないべき（Task 1・Task 4 のテスト）
- 検索で全角半角・大文字小文字の違いで見つからない → 同じ文字として見つかるべき（Task 1 のテスト）
- 条件の値が空のままルールを保存して、何にも当たらないルールが増える → 保存せずに理由を出すべき（Task 1・Task 5 のテスト）
- フォルダ名を重複する名前に変えようとして、黙って失敗する → 理由を出して元の名前に戻すべき（Task 5 のテスト）
- 別アプリのファイルや壊れた JSON を読み込む → 何も変えずに理由を出すべき（Task 6 のテスト）

---

## File Structure

| ファイル | 役割 |
|---|---|
| `src/core/views.ts` | 一覧の絞り込み（すべて・未整理・AI・解除済み・非表示・フォルダ）、検索、並べ替え、件数 |
| `src/core/move.ts` | 配列の要素を動かす（フォルダの並べ替え用） |
| `src/core/condition-input.ts` | ルールの入力欄 → `Condition`、`Condition` → 表示用の値 |
| `src/i18n/ja.ts` / `src/i18n/index.ts` | 日本語の辞書と `t()` |
| `src/dashboard/labels.ts` | 選択肢などの値 → 辞書のキー |
| `src/dashboard/db-context.tsx` | 使う DB を差し替えられるようにする（テスト用） |
| `src/dashboard/errors.tsx` | DB 操作の失敗を画面上部に出す `useRun()` |
| `src/dashboard/data.ts` | DB を見張って最新の中身を返すフック |
| `src/dashboard/badge.ts` | 裏方にアイコンの件数の更新を頼む |
| `src/dashboard/PostCard.tsx` | 投稿 1 件の表示 |
| `src/dashboard/BulkBar.tsx` | 選んだ投稿をまとめて操作する帯 |
| `src/dashboard/Sidebar.tsx` | 左の絞り込み一覧 |
| `src/dashboard/ReviewStrip.tsx` | 今日の積みツイ崩し |
| `src/dashboard/Shelf.tsx` | 「本棚」タブ |
| `src/dashboard/FolderEditor.tsx` / `RuleEditor.tsx` / `Organize.tsx` | 「フォルダとルール」タブ |
| `src/dashboard/SettingsPanel.tsx` | 「設定」タブ |
| `src/config.ts` | プライバシーポリシーと寄付のリンク（空なら出さない） |
| `src/entrypoints/dashboard/App.tsx` | （変更）タブと全体の枠 |

---

### Task 1: 一覧の絞り込み・検索・並べ替え（純粋関数）

**Files:**
- Create: `src/core/views.ts`, `src/core/move.ts`, `src/core/condition-input.ts`
- Test: `src/core/views.test.ts`, `src/core/move.test.ts`, `src/core/condition-input.test.ts`

**Interfaces:**
- Produces（`views.ts`）: `type View`（`all` / `unsorted` / `ai` / `removed` / `hidden` / `{ kind: "folder"; folderId }`）、`type SortKey = "bookmark-desc" | "bookmark-asc" | "posted-desc" | "posted-asc"`、`SORT_KEYS: SortKey[]`、`viewKey(v: View): string`、`inView(post: Post, view: View): boolean`、`matchesQuery(post: Post, query: string): boolean`、`selectPosts(posts: Post[], opts: { view: View; query: string; sort: SortKey }): Post[]`、`type ViewCounts = { all: number; unsorted: number; ai: number; removed: number; hidden: number; folders: Record<string, number> }`、`viewCounts(posts: Post[]): ViewCounts`
- Produces（`move.ts`）: `moveItem<T>(items: T[], from: number, to: number): T[]`
- Produces（`condition-input.ts`）: `type ConditionKind = Condition["kind"]`、`CONDITION_KINDS: ConditionKind[]`、`MEDIA_CHOICES: ("any" | "photo" | "video")[]`、`type ConditionDraft = { kind: ConditionKind; value: string }`、`emptyDraft(kind?: ConditionKind): ConditionDraft`、`draftToCondition(d: ConditionDraft): Condition | null`、`conditionValue(c: Condition): string`

- [ ] **Step 1: 失敗するテストを書く**

`src/core/views.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makePost } from "../test/factories";
import { inView, matchesQuery, selectPosts, viewCounts, viewKey } from "./views";

const unsorted = makePost({ id: "1", text: "Unity の講座", bookmarkOrder: "10", postedAt: "2026-01-03T00:00:00.000Z" });
const inA = makePost({ id: "2", folders: [{ folderId: "a", by: "manual" }], bookmarkOrder: "30", postedAt: "2026-01-01T00:00:00.000Z" });
const byAi = makePost({ id: "3", folders: [{ folderId: "b", by: "ai" }], removedOnX: true, bookmarkOrder: "20", postedAt: "2026-01-02T00:00:00.000Z" });
const hidden = makePost({ id: "4", hidden: true, folders: [{ folderId: "a", by: "manual" }] });
const all = [unsorted, inA, byAi, hidden];

describe("inView", () => {
  it("非表示は『非表示にしたもの』にだけ出る", () => {
    expect(inView(hidden, { kind: "all" })).toBe(false);
    expect(inView(hidden, { kind: "folder", folderId: "a" })).toBe(false);
    expect(inView(hidden, { kind: "hidden" })).toBe(true);
    expect(inView(unsorted, { kind: "hidden" })).toBe(false);
  });
  it("未整理・AI・解除済み・フォルダ", () => {
    expect(inView(unsorted, { kind: "unsorted" })).toBe(true);
    expect(inView(inA, { kind: "unsorted" })).toBe(false);
    expect(inView(byAi, { kind: "ai" })).toBe(true);
    expect(inView(inA, { kind: "ai" })).toBe(false);
    expect(inView(byAi, { kind: "removed" })).toBe(true);
    expect(inView(inA, { kind: "folder", folderId: "a" })).toBe(true);
    expect(inView(inA, { kind: "folder", folderId: "b" })).toBe(false);
  });
});

describe("matchesQuery", () => {
  it("本文・表示名・@名・引用元の本文を、全角半角と大文字小文字を区別せずに探す", () => {
    const p = makePost({ text: "ﾕﾆﾃｨ講座", author: { id: "u", handle: "GameDev", name: "ゲーム太郎", avatarUrl: "" }, quoted: { id: "9", authorHandle: "x", text: "元ネタ" } });
    expect(matchesQuery(p, "ユニティ")).toBe(true);
    expect(matchesQuery(p, "gamedev")).toBe(true);
    expect(matchesQuery(p, "太郎")).toBe(true);
    expect(matchesQuery(p, "元ネタ")).toBe(true);
    expect(matchesQuery(p, "ない言葉")).toBe(false);
    expect(matchesQuery(p, "  ")).toBe(true);
  });
});

describe("selectPosts", () => {
  it("絞り込んでから並べる", () => {
    const ids = (sort: Parameters<typeof selectPosts>[1]["sort"]) => selectPosts(all, { view: { kind: "all" }, query: "", sort }).map((p) => p.id);
    expect(ids("bookmark-desc")).toEqual(["2", "3", "1"]);
    expect(ids("bookmark-asc")).toEqual(["1", "3", "2"]);
    expect(ids("posted-desc")).toEqual(["1", "3", "2"]);
    expect(ids("posted-asc")).toEqual(["2", "3", "1"]);
    expect(selectPosts(all, { view: { kind: "all" }, query: "unity", sort: "bookmark-desc" }).map((p) => p.id)).toEqual(["1"]);
  });
  it("元の配列を変えない", () => {
    const copy = [...all];
    selectPosts(all, { view: { kind: "all" }, query: "", sort: "posted-asc" });
    expect(all).toEqual(copy);
  });
});

describe("viewCounts", () => {
  it("非表示を除いて数え、非表示は別に数える", () => {
    expect(viewCounts(all)).toEqual({ all: 3, unsorted: 1, ai: 1, removed: 1, hidden: 1, folders: { a: 1, b: 1 } });
  });
});

describe("viewKey", () => {
  it("フォルダは ID ごとに別のキー", () => {
    expect(viewKey({ kind: "all" })).toBe("all");
    expect(viewKey({ kind: "folder", folderId: "x" })).toBe("folder:x");
  });
});
```

`src/core/move.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { moveItem } from "./move";

describe("moveItem", () => {
  it("指定の位置へ動かし、元の配列は変えない", () => {
    const items = ["a", "b", "c"];
    expect(moveItem(items, 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(items, 2, 0)).toEqual(["c", "a", "b"]);
    expect(items).toEqual(["a", "b", "c"]);
  });
  it("範囲外なら元のまま", () => {
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });
});
```

`src/core/condition-input.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { conditionValue, draftToCondition, emptyDraft } from "./condition-input";

describe("draftToCondition", () => {
  it("種類ごとに Condition にする（前後の空白・@・# は取り除く）", () => {
    expect(draftToCondition({ kind: "keyword", value: " Unity " })).toEqual({ kind: "keyword", value: "Unity" });
    expect(draftToCondition({ kind: "author", value: "＠gamedev" })).toEqual({ kind: "author", handle: "gamedev" });
    expect(draftToCondition({ kind: "hashtag", value: "#推し活" })).toEqual({ kind: "hashtag", tag: "推し活" });
    expect(draftToCondition({ kind: "domain", value: "youtube.com" })).toEqual({ kind: "domain", domain: "youtube.com" });
    expect(draftToCondition({ kind: "hasMedia", value: "video" })).toEqual({ kind: "hasMedia", media: "video" });
  });
  it("値が空・不正なら null", () => {
    expect(draftToCondition({ kind: "keyword", value: "  " })).toBeNull();
    expect(draftToCondition({ kind: "author", value: "@" })).toBeNull();
    expect(draftToCondition({ kind: "hashtag", value: "＃" })).toBeNull();
    expect(draftToCondition({ kind: "hasMedia", value: "audio" })).toBeNull();
  });
});

describe("emptyDraft", () => {
  it("画像・動画ありだけは最初から『どれでも』", () => {
    expect(emptyDraft()).toEqual({ kind: "keyword", value: "" });
    expect(emptyDraft("hasMedia")).toEqual({ kind: "hasMedia", value: "any" });
  });
});

describe("conditionValue", () => {
  it("表示用の値", () => {
    expect(conditionValue({ kind: "author", handle: "gamedev" })).toBe("@gamedev");
    expect(conditionValue({ kind: "hashtag", tag: "推し活" })).toBe("#推し活");
    expect(conditionValue({ kind: "keyword", value: "Unity" })).toBe("Unity");
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/core/views.test.ts src/core/move.test.ts src/core/condition-input.test.ts`
Expected: FAIL（モジュールが見つからない）

- [ ] **Step 3: 実装する**

`src/core/views.ts`:

```ts
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
```

`src/core/move.ts`:

```ts
/** 配列の from 番目の要素を to 番目へ動かした新しい配列。範囲外なら元の配列 */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item === undefined) return items;
  next.splice(to, 0, item);
  return next;
}
```

`src/core/condition-input.ts`:

```ts
import type { Condition } from "./types";

export type ConditionKind = Condition["kind"];
export const CONDITION_KINDS: ConditionKind[] = ["keyword", "author", "hashtag", "domain", "hasMedia"];
export const MEDIA_CHOICES: ("any" | "photo" | "video")[] = ["any", "photo", "video"];

/** ルールの入力欄の中身（種類と、文字の値） */
export type ConditionDraft = { kind: ConditionKind; value: string };

export function emptyDraft(kind: ConditionKind = "keyword"): ConditionDraft {
  return { kind, value: kind === "hasMedia" ? "any" : "" };
}

/** 入力欄の中身を Condition にする。値が空・不正なら null */
export function draftToCondition(d: ConditionDraft): Condition | null {
  const v = d.value.trim();
  switch (d.kind) {
    case "keyword":
      return v ? { kind: "keyword", value: v } : null;
    case "author": {
      const handle = v.replace(/^[@＠]/, "");
      return handle ? { kind: "author", handle } : null;
    }
    case "hashtag": {
      const tag = v.replace(/^[#＃]/, "");
      return tag ? { kind: "hashtag", tag } : null;
    }
    case "domain":
      return v ? { kind: "domain", domain: v } : null;
    case "hasMedia":
      return v === "any" || v === "photo" || v === "video" ? { kind: "hasMedia", media: v } : null;
  }
}

/** 一覧に出す条件の値（画像・動画ありは選択肢の値そのもの） */
export function conditionValue(c: Condition): string {
  switch (c.kind) {
    case "keyword":
      return c.value;
    case "author":
      return `@${c.handle}`;
    case "hashtag":
      return `#${c.tag}`;
    case "domain":
      return c.domain;
    case "hasMedia":
      return c.media;
  }
}
```

- [ ] **Step 4: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし

- [ ] **Step 5: Commit**

```bash
git add src/core/views.ts src/core/views.test.ts src/core/move.ts src/core/move.test.ts src/core/condition-input.ts src/core/condition-input.test.ts
git commit -m "本棚: 一覧の絞り込み・検索・並べ替えとルール入力の変換" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 文言の辞書

**Files:**
- Create: `src/i18n/ja.ts`, `src/i18n/index.ts`, `src/dashboard/labels.ts`
- Test: `src/i18n/index.test.ts`

**Interfaces:**
- Consumes: `SortKey`（Task 1）、`ConditionKind`（Task 1）、`ImportError`（計画1）
- Produces（`i18n`）: `ja`（辞書）、`type MessageKey = keyof typeof ja`、`t(key: MessageKey, params?: Record<string, string | number>): string`
- Produces（`labels.ts`）: `SORT_LABEL: Record<SortKey, MessageKey>`、`COND_LABEL: Record<ConditionKind, MessageKey>`、`MEDIA_LABEL: Record<"any" | "photo" | "video", MessageKey>`、`IMPORT_ERROR_LABEL: Record<ImportError, MessageKey>`、`FOLDER_ERROR_LABEL: Record<"empty" | "duplicate", MessageKey>`

- [ ] **Step 1: 失敗するテストを書く**

`src/i18n/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ja, t } from "./index";

describe("t", () => {
  it("辞書の文言を返し、{名前} を差し込む", () => {
    expect(t("app.title")).toBe("ツイッ棚");
    expect(t("review.left", { count: 3 })).toBe("残り 3 件");
    expect(t("settings.imported", { posts: 1, folders: 2, rules: 0 })).toBe("読み込みました：投稿 1 件・新しいフォルダ 2 個・新しいルール 0 個");
  });
  it("同じ名前が 2 回あっても両方差し込む", () => {
    expect(t("folders.confirmDelete", { name: "A" })).toContain("「A」");
  });
  it("辞書の文言は空でない", () => {
    for (const [key, text] of Object.entries(ja)) expect(text, key).not.toBe("");
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/i18n/index.test.ts`
Expected: FAIL（`./index` が見つからない）

- [ ] **Step 3: 実装する**

`src/i18n/ja.ts`:

```ts
/** 画面の文言（日本語）。{名前} は t() の params で差し込む */
export const ja = {
  "app.title": "ツイッ棚",
  "app.unofficial": "非公式ツールです（X Corp. とは関係ありません）。データはこのブラウザの中だけに保存され、外部には送りません。",
  "tab.shelf": "本棚",
  "tab.organize": "フォルダとルール",
  "tab.settings": "設定",
  "error.generic": "保存に失敗しました（{message}）。念のため「設定」の「書き出す」でデータを退避してください。",
  "error.close": "閉じる",
  "view.all": "すべて",
  "view.unsorted": "未整理",
  "view.ai": "AI が入れたもの",
  "view.removed": "X で解除済み",
  "view.hidden": "非表示にしたもの",
  "view.folders": "フォルダ",
  "view.nav": "絞り込み",
  "shelf.search": "本文・名前・@名で検索",
  "shelf.sort": "並び順",
  "shelf.sort.bookmark-desc": "ブクマの新しい順",
  "shelf.sort.bookmark-asc": "ブクマの古い順",
  "shelf.sort.posted-desc": "投稿の新しい順",
  "shelf.sort.posted-asc": "投稿の古い順",
  "shelf.count": "{count} 件",
  "shelf.list": "投稿の一覧",
  "shelf.empty": "ここにはまだ何もありません。X のブックマーク画面を開いてスクロールすると取り込まれます。",
  "shelf.more": "もっと見る（残り {count} 件）",
  "bulk.selected": "{count} 件を選択中",
  "bulk.chooseFolder": "フォルダを選ぶ",
  "bulk.add": "入れる",
  "bulk.remove": "外す",
  "bulk.hide": "非表示にする",
  "bulk.unhide": "表示に戻す",
  "bulk.clear": "選択を解除",
  "post.select": "この投稿を選ぶ",
  "post.open": "X で開く",
  "post.removed": "X で解除済み",
  "post.partial": "中身は、X のブックマーク画面を開くと入ります",
  "post.by.ai": "AI",
  "post.by.rule": "ルール",
  "post.quoted": "引用：@{handle}",
  "review.title": "今日の積みツイ崩し",
  "review.left": "残り {count} 件",
  "review.seen": "見た",
  "review.toFolder": "フォルダへ入れる",
  "review.hide": "もう出さない",
  "review.done": "今日の分はおしまい！また明日。",
  "folders.title": "フォルダ",
  "folders.new": "新しいフォルダの名前",
  "folders.add": "追加",
  "folders.name": "フォルダの名前",
  "folders.description": "説明（AI へのヒント。例：推しの配信告知）",
  "folders.up": "上へ",
  "folders.down": "下へ",
  "folders.delete": "削除",
  "folders.confirmDelete": "フォルダ「{name}」を削除しますか？ 投稿は消えず、このフォルダから外れるだけです。このフォルダ宛てのルールは消えます。",
  "folders.error.empty": "名前を入れてください",
  "folders.error.duplicate": "同じ名前のフォルダがあります",
  "folders.none": "まだフォルダがありません",
  "rules.title": "自動振り分けのルール",
  "rules.help": "条件をすべて満たした投稿を、選んだフォルダに入れます。手で整理した投稿には手を出しません。",
  "rules.folder": "入れ先",
  "rules.kind": "条件の種類",
  "rules.addCondition": "条件を足す",
  "rules.removeCondition": "この条件を消す",
  "rules.save": "ルールを追加",
  "rules.enabled": "有効",
  "rules.delete": "削除",
  "rules.applyNow": "未整理に今すぐ適用",
  "rules.applied": "{count} 件を振り分けました",
  "rules.none": "まだルールがありません",
  "rules.needFolder": "先にフォルダを作ってください",
  "rules.invalid": "条件の値を入れてください",
  "cond.keyword": "本文に含む",
  "cond.author": "投稿者（@名）",
  "cond.hashtag": "ハッシュタグ",
  "cond.domain": "リンク先のサイト",
  "cond.hasMedia": "画像・動画あり",
  "cond.media.any": "どれでも",
  "cond.media.photo": "画像",
  "cond.media.video": "動画・GIF",
  "settings.stats": "取り込んだ投稿：{count} 件",
  "settings.picker": "ブクマした瞬間にフォルダ選択メニューを出す",
  "settings.reviewPerDay": "1 日に見返す件数（明日から反映）",
  "settings.backup": "バックアップ",
  "settings.export": "書き出す（JSON）",
  "settings.import": "読み込む",
  "settings.imported": "読み込みました：投稿 {posts} 件・新しいフォルダ {folders} 個・新しいルール {rules} 個",
  "settings.importError.not-json": "JSON ファイルではありません",
  "settings.importError.wrong-app": "ツイッ棚の書き出しファイルではありません",
  "settings.importError.unsupported-version": "このバージョンでは読み込めない形式です",
  "settings.importError.invalid-shape": "ファイルの中身が壊れているようです",
  "settings.health.warning": "X の仕様が変わったようで、最近うまく取り込めていません（{op}）。拡張の更新をお待ちください。",
  "settings.about": "このツールについて",
  "settings.privacy": "プライバシーポリシー",
  "settings.donate": "開発を応援する",
} as const;
```

`src/i18n/index.ts`:

```ts
import { ja } from "./ja";

export { ja };
export type MessageKey = keyof typeof ja;

/** 文言を引く。{名前} を params の値で置き換える（英語は計画4で足す） */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  let text: string = ja[key];
  for (const [name, value] of Object.entries(params)) text = text.split(`{${name}}`).join(String(value));
  return text;
}
```

`src/dashboard/labels.ts`:

```ts
import type { ConditionKind } from "../core/condition-input";
import type { ImportError } from "../core/export-format";
import type { SortKey } from "../core/views";
import type { MessageKey } from "../i18n";

export const SORT_LABEL: Record<SortKey, MessageKey> = {
  "bookmark-desc": "shelf.sort.bookmark-desc",
  "bookmark-asc": "shelf.sort.bookmark-asc",
  "posted-desc": "shelf.sort.posted-desc",
  "posted-asc": "shelf.sort.posted-asc",
};

export const COND_LABEL: Record<ConditionKind, MessageKey> = {
  keyword: "cond.keyword",
  author: "cond.author",
  hashtag: "cond.hashtag",
  domain: "cond.domain",
  hasMedia: "cond.hasMedia",
};

export const MEDIA_LABEL: Record<"any" | "photo" | "video", MessageKey> = {
  any: "cond.media.any",
  photo: "cond.media.photo",
  video: "cond.media.video",
};

export const IMPORT_ERROR_LABEL: Record<ImportError, MessageKey> = {
  "not-json": "settings.importError.not-json",
  "wrong-app": "settings.importError.wrong-app",
  "unsupported-version": "settings.importError.unsupported-version",
  "invalid-shape": "settings.importError.invalid-shape",
};

export const FOLDER_ERROR_LABEL: Record<"empty" | "duplicate", MessageKey> = {
  empty: "folders.error.empty",
  duplicate: "folders.error.duplicate",
};
```

- [ ] **Step 4: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし

- [ ] **Step 5: Commit**

```bash
git add src/i18n src/dashboard/labels.ts
git commit -m "本棚: 文言の辞書と t()" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 本棚画面の土台と投稿の表示

**Files:**
- Create: `src/dashboard/db-context.tsx`, `src/dashboard/errors.tsx`, `src/dashboard/data.ts`, `src/dashboard/badge.ts`, `src/dashboard/PostCard.tsx`, `src/dashboard/BulkBar.tsx`
- Test: `src/dashboard/PostCard.test.tsx`, `src/dashboard/BulkBar.test.tsx`

**Interfaces:**
- Consumes: `t`（Task 2）、`getDb`, `TwitTanaDB`、`listFolders`、`listRules`、`getSettings`（計画1）
- Produces（`db-context.tsx`）: `DbProvider`（React の Provider。`value: TwitTanaDB`）、`useDb(): TwitTanaDB`
- Produces（`errors.tsx`）: `ErrorProvider`（`value: (message: string) => void`）、`useRun(): <T>(action: () => Promise<T>) => Promise<T | undefined>`
- Produces（`data.ts`）: `usePosts(): Post[] | undefined`、`useFolders(): Folder[] | undefined`、`useRules(): Rule[] | undefined`、`useSettings(): Settings | undefined`、`usePostCount(): number | undefined`
- Produces（`badge.ts`）: `requestBadgeRefresh(): void`
- Produces（`PostCard.tsx`）: `PostCard(props: { post: Post; folders: Map<string, Folder>; selected?: boolean; onSelect?: (on: boolean) => void; children?: ReactNode })`
- Produces（`BulkBar.tsx`）: `BulkBar(props: { count: number; folders: Folder[]; hiddenView: boolean; onAdd(folderId: string): void; onRemove(folderId: string): void; onToggleHidden(): void; onClear(): void })`

- [ ] **Step 1: 依存を入れる**

Run: `npm install dexie-react-hooks`

- [ ] **Step 2: 失敗するテストを書く**

`src/dashboard/PostCard.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Folder } from "../core/types";
import { makePost } from "../test/factories";
import { PostCard } from "./PostCard";

afterEach(cleanup);

const folders = new Map<string, Folder>([
  ["a", { id: "a", name: "ゲーム", description: "", order: 0, createdAt: "" }],
  ["b", { id: "b", name: "料理", description: "", order: 1, createdAt: "" }],
]);

describe("PostCard", () => {
  it("本文・投稿者・フォルダ（AI やルールの印つき）・X へのリンクを出す", () => {
    const post = makePost({
      id: "1",
      text: "おもしろい",
      folders: [
        { folderId: "a", by: "manual" },
        { folderId: "b", by: "ai" },
        { folderId: "gone", by: "rule" },
      ],
    });
    render(<PostCard post={post} folders={folders} />);
    expect(screen.getByText("おもしろい")).toBeTruthy();
    expect(screen.getByText("@someone")).toBeTruthy();
    expect(screen.getByText("ゲーム")).toBeTruthy();
    expect(screen.getByText("料理").textContent).toBe("料理AI");
    const link = screen.getByRole("link", { name: "X で開く" });
    expect(link.getAttribute("href")).toBe("https://x.com/someone/status/1");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("解除済みの印と、中身が無いときの案内", () => {
    render(<PostCard post={makePost({ removedOnX: true, partial: true, text: "" })} folders={folders} />);
    expect(screen.getByText("X で解除済み")).toBeTruthy();
    expect(screen.getByText("中身は、X のブックマーク画面を開くと入ります")).toBeTruthy();
  });

  it("選ぶチェックを押すと知らせる", () => {
    const onSelect = vi.fn();
    render(<PostCard post={makePost()} folders={folders} selected={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "この投稿を選ぶ" }));
    expect(onSelect).toHaveBeenCalledWith(true);
  });
});
```

`src/dashboard/BulkBar.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BulkBar } from "./BulkBar";

afterEach(cleanup);

function setup(hiddenView = false) {
  const props = {
    count: 2,
    folders: [{ id: "a", name: "ゲーム", description: "", order: 0, createdAt: "" }],
    hiddenView,
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onToggleHidden: vi.fn(),
    onClear: vi.fn(),
  };
  render(<BulkBar {...props} />);
  return props;
}

describe("BulkBar", () => {
  it("フォルダを選ぶまで入れる・外すは押せない", () => {
    const p = setup();
    expect((screen.getByRole("button", { name: "入れる" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("フォルダを選ぶ"), { target: { value: "a" } });
    fireEvent.click(screen.getByRole("button", { name: "入れる" }));
    fireEvent.click(screen.getByRole("button", { name: "外す" }));
    expect(p.onAdd).toHaveBeenCalledWith("a");
    expect(p.onRemove).toHaveBeenCalledWith("a");
  });

  it("非表示の一覧では『表示に戻す』になる", () => {
    const p = setup(true);
    fireEvent.click(screen.getByRole("button", { name: "表示に戻す" }));
    expect(p.onToggleHidden).toHaveBeenCalled();
    expect(screen.getByText("2 件を選択中")).toBeTruthy();
  });
});
```

- [ ] **Step 3: 失敗を確かめる**

Run: `npx vitest run src/dashboard`
Expected: FAIL（`./PostCard` と `./BulkBar` が見つからない）

- [ ] **Step 4: 実装する**

`src/dashboard/db-context.tsx`:

```tsx
import { createContext, useContext } from "react";
import { getDb, type TwitTanaDB } from "../db/schema";

const DbContext = createContext<TwitTanaDB | null>(null);

/** テストで別の DB を使うための Provider。無ければ拡張全体で共有の DB を使う */
export const DbProvider = DbContext.Provider;

export function useDb(): TwitTanaDB {
  return useContext(DbContext) ?? getDb();
}
```

`src/dashboard/errors.tsx`:

```tsx
import { createContext, useCallback, useContext } from "react";
import { t } from "../i18n";

const ErrorContext = createContext<(message: string) => void>(() => {});

/** DB 操作の失敗を画面上部に出す先 */
export const ErrorProvider = ErrorContext.Provider;

/** DB 操作を実行し、失敗したら画面上部に理由を出す */
export function useRun() {
  const report = useContext(ErrorContext);
  return useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await action();
      } catch (e) {
        report(t("error.generic", { message: e instanceof Error ? e.message : String(e) }));
        return undefined;
      }
    },
    [report],
  );
}
```

`src/dashboard/data.ts`:

```ts
import { useLiveQuery } from "dexie-react-hooks";
import type { Folder, Post, Rule, Settings } from "../core/types";
import { listFolders } from "../db/folders";
import { listRules } from "../db/rules-repo";
import { getSettings } from "../db/settings";
import { useDb } from "./db-context";

/** DB を見張り、変わったら最新の中身を返す（読み込み中は undefined） */
export function usePosts(): Post[] | undefined {
  const db = useDb();
  return useLiveQuery(() => db.posts.toArray(), [db]);
}

export function useFolders(): Folder[] | undefined {
  const db = useDb();
  return useLiveQuery(() => listFolders(db), [db]);
}

export function useRules(): Rule[] | undefined {
  const db = useDb();
  return useLiveQuery(() => listRules(db), [db]);
}

export function useSettings(): Settings | undefined {
  const db = useDb();
  return useLiveQuery(() => getSettings(db), [db]);
}

export function usePostCount(): number | undefined {
  const db = useDb();
  return useLiveQuery(() => db.posts.count(), [db]);
}
```

`src/dashboard/badge.ts`:

```ts
import { browser } from "#imports";

/** 裏方に、拡張アイコンの件数を数え直してもらう（失敗しても気にしない） */
export function requestBadgeRefresh(): void {
  try {
    void browser.runtime.sendMessage({ type: "refresh-badge" }).catch(() => {});
  } catch {
    // テスト環境など、送れないときは何もしない
  }
}
```

`src/dashboard/PostCard.tsx`:

```tsx
import type { ReactNode } from "react";
import type { Folder, Post } from "../core/types";
import { t } from "../i18n";

type Props = {
  post: Post;
  folders: Map<string, Folder>;
  selected?: boolean;
  onSelect?: (on: boolean) => void;
  children?: ReactNode;
};

/** 投稿 1 件の表示 */
export function PostCard({ post, folders, selected, onSelect, children }: Props) {
  const date = post.postedAt ? new Date(post.postedAt).toLocaleDateString() : "";
  return (
    <article className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-800">
      <div className="flex items-start gap-3">
        {onSelect && (
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-amber-700"
            aria-label={t("post.select")}
            checked={!!selected}
            onChange={(e) => onSelect(e.target.checked)}
          />
        )}
        {post.author.avatarUrl && (
          <img src={post.author.avatarUrl} alt="" className="h-10 w-10 rounded-full" loading="lazy" referrerPolicy="no-referrer" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-bold">{post.author.name || post.author.handle}</span>
            {post.author.handle && <span className="text-stone-500">@{post.author.handle}</span>}
            {date && <span className="text-stone-500">{date}</span>}
            {post.removedOnX && (
              <span className="rounded bg-stone-200 px-1.5 text-xs dark:bg-stone-700">{t("post.removed")}</span>
            )}
          </div>
          {post.partial ? (
            <p className="mt-1 text-sm text-stone-500">{t("post.partial")}</p>
          ) : (
            <p className="mt-1 whitespace-pre-wrap break-words">{post.text}</p>
          )}
          {post.quoted && (
            <blockquote className="mt-2 rounded-lg border-l-4 border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900">
              <span className="text-stone-500">{t("post.quoted", { handle: post.quoted.authorHandle })}</span>
              <span className="mt-1 block whitespace-pre-wrap break-words">{post.quoted.text}</span>
            </blockquote>
          )}
          {post.media.length > 0 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {post.media.map((m, i) => (
                <img
                  key={`${i}-${m.thumbUrl}`}
                  src={m.thumbUrl}
                  alt=""
                  className="h-24 rounded-lg object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ))}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {post.folders.map((a) => {
              const folder = folders.get(a.folderId);
              if (!folder) return null;
              return (
                <span key={a.folderId} className="rounded-full bg-amber-100 px-2 py-0.5 dark:bg-stone-700">
                  {folder.name}
                  {a.by !== "manual" && (
                    <span className="ml-1 font-bold text-amber-700 dark:text-amber-300">{t(a.by === "ai" ? "post.by.ai" : "post.by.rule")}</span>
                  )}
                </span>
              );
            })}
            <a href={post.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-amber-800 underline dark:text-amber-300">
              {t("post.open")}
            </a>
          </div>
          {children}
        </div>
      </div>
    </article>
  );
}
```

`src/dashboard/BulkBar.tsx`:

```tsx
import { useState } from "react";
import type { Folder } from "../core/types";
import { t } from "../i18n";

type Props = {
  count: number;
  folders: Folder[];
  hiddenView: boolean;
  onAdd(folderId: string): void;
  onRemove(folderId: string): void;
  onToggleHidden(): void;
  onClear(): void;
};

const BUTTON = "rounded-lg bg-amber-700 px-3 py-1 text-sm text-white disabled:opacity-40 dark:bg-amber-600";
const SUBTLE = "rounded-lg px-3 py-1 text-sm hover:bg-amber-100 dark:hover:bg-stone-600";

/** 選んだ投稿をまとめて操作する帯 */
export function BulkBar({ count, folders, hiddenView, onAdd, onRemove, onToggleHidden, onClear }: Props) {
  const [folderId, setFolderId] = useState("");
  return (
    <div role="toolbar" aria-label={t("bulk.selected", { count })} className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-xl bg-amber-200 p-2 dark:bg-stone-700">
      <span className="px-2 font-bold">{t("bulk.selected", { count })}</span>
      <select
        aria-label={t("bulk.chooseFolder")}
        value={folderId}
        onChange={(e) => setFolderId(e.target.value)}
        className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-sm dark:border-stone-600 dark:bg-stone-800"
      >
        <option value="">{t("bulk.chooseFolder")}</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <button type="button" className={BUTTON} disabled={!folderId} onClick={() => onAdd(folderId)}>
        {t("bulk.add")}
      </button>
      <button type="button" className={BUTTON} disabled={!folderId} onClick={() => onRemove(folderId)}>
        {t("bulk.remove")}
      </button>
      <button type="button" className={SUBTLE} onClick={onToggleHidden}>
        {t(hiddenView ? "bulk.unhide" : "bulk.hide")}
      </button>
      <button type="button" className={`${SUBTLE} ml-auto`} onClick={onClear}>
        {t("bulk.clear")}
      </button>
    </div>
  );
}
```

- [ ] **Step 5: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/dashboard
git commit -m "本棚: 画面の土台（DB の見張り・失敗の表示）と投稿カード・まとめて操作の帯" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 「本棚」タブ（絞り込み・一覧・今日の積みツイ崩し）

**Files:**
- Create: `src/dashboard/Sidebar.tsx`, `src/dashboard/ReviewStrip.tsx`, `src/dashboard/Shelf.tsx`
- Test: `src/dashboard/Shelf.test.tsx`

**Interfaces:**
- Consumes: Task 1〜3 のすべて、`ensureTodayReview`・`completeReview`（計画1）、`addToFolder`・`removeFromFolder`・`setHidden`（計画1）
- Produces: `Sidebar(props: { view: View; onChange(v: View): void; counts: ViewCounts; folders: Folder[] })`、`ReviewStrip(props: { posts: Map<string, Post>; folders: Folder[] })`、`Shelf()`、`SHELF_PAGE_SIZE = 100`

- [ ] **Step 1: 失敗するテストを書く**

`src/dashboard/Shelf.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { localDateString } from "../core/review";
import { makePost } from "../test/factories";
import { openTestDb } from "../test/db";
import { DbProvider } from "./db-context";
import { Shelf } from "./Shelf";

const db = openTestDb();
afterEach(async () => {
  cleanup();
  await Promise.all([db.posts.clear(), db.folders.clear(), db.rules.clear(), db.kv.clear()]);
});

async function seed() {
  await db.folders.put({ id: "a", name: "ゲーム", description: "", order: 0, createdAt: "" });
  await db.posts.bulkPut([
    makePost({ id: "1", text: "未整理の投稿", bookmarkOrder: "10", review: { count: 1, lastAt: "2026-01-01T00:00:00.000Z" } }),
    makePost({ id: "2", text: "ゲームの投稿", bookmarkOrder: "20", folders: [{ folderId: "a", by: "manual" }], review: { count: 1, lastAt: "2026-01-01T00:00:00.000Z" } }),
    makePost({ id: "3", text: "隠した投稿", hidden: true }),
  ]);
}

function renderShelf() {
  render(
    <DbProvider value={db}>
      <Shelf />
    </DbProvider>,
  );
}

describe("Shelf", () => {
  it("非表示以外を新しいブクマ順に出し、絞り込みで切り替える", async () => {
    await seed();
    renderShelf();
    const list = await screen.findByRole("list", { name: "投稿の一覧" });
    await waitFor(() => expect(within(list).getAllByRole("article")).toHaveLength(2));
    expect(within(list).getAllByRole("article").map((a) => a.textContent?.includes("ゲームの投稿"))).toEqual([true, false]);
    expect(screen.queryByText("隠した投稿")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /未整理/ }));
    await waitFor(() => expect(within(list).getAllByRole("article")).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: /非表示にしたもの/ }));
    expect(await within(list).findByText("隠した投稿")).toBeTruthy();
  });

  it("検索で絞り込む", async () => {
    await seed();
    renderShelf();
    const list = await screen.findByRole("list", { name: "投稿の一覧" });
    fireEvent.change(screen.getByLabelText("本文・名前・@名で検索"), { target: { value: "ゲーム" } });
    await waitFor(() => expect(within(list).getAllByRole("article")).toHaveLength(1));
  });

  it("選んでフォルダに入れると DB に手動で入る", async () => {
    await seed();
    renderShelf();
    const list = await screen.findByRole("list", { name: "投稿の一覧" });
    await waitFor(() => expect(within(list).getAllByRole("checkbox")).toHaveLength(2));
    const checkboxes = within(list).getAllByRole("checkbox");
    fireEvent.click(checkboxes[1] as HTMLElement);
    fireEvent.change(screen.getByLabelText("フォルダを選ぶ"), { target: { value: "a" } });
    fireEvent.click(screen.getByRole("button", { name: "入れる" }));
    await waitFor(async () => expect((await db.posts.get("1"))?.folders).toEqual([{ folderId: "a", by: "manual" }]));
  });

  it("今日の積みツイ崩しで『見た』を押すと済みになる", async () => {
    await db.posts.put(makePost({ id: "9", text: "昔のブクマ" }));
    renderShelf();
    const strip = await screen.findByRole("region", { name: "今日の積みツイ崩し" });
    fireEvent.click(await within(strip).findByRole("button", { name: "見た" }));
    expect(await within(strip).findByText("今日の分はおしまい！また明日。")).toBeTruthy();
    expect((await db.posts.get("9"))?.review.count).toBe(1);
    const settings = await db.kv.get("settings");
    expect((settings?.value as { todayReview?: { date: string } }).todayReview?.date).toBe(localDateString(new Date()));
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/dashboard/Shelf.test.tsx`
Expected: FAIL（`./Shelf` が見つからない）

- [ ] **Step 3: 実装する**

`src/dashboard/Sidebar.tsx`:

```tsx
import type { Folder } from "../core/types";
import { viewKey, type View, type ViewCounts } from "../core/views";
import { t } from "../i18n";

type Props = { view: View; onChange(v: View): void; counts: ViewCounts; folders: Folder[] };

/** 左の絞り込み一覧 */
export function Sidebar({ view, onChange, counts, folders }: Props) {
  const item = (v: View, label: string, count: number) => {
    const active = viewKey(v) === viewKey(view);
    return (
      <li key={viewKey(v)}>
        <button
          type="button"
          aria-current={active ? "true" : undefined}
          onClick={() => onChange(v)}
          className={`flex w-full justify-between gap-2 rounded-lg px-3 py-1.5 text-left ${
            active ? "bg-amber-200 font-bold dark:bg-stone-700" : "hover:bg-amber-100 dark:hover:bg-stone-800"
          }`}
        >
          <span className="truncate">{label}</span>
          <span className="text-stone-500">{count}</span>
        </button>
      </li>
    );
  };
  return (
    <nav aria-label={t("view.nav")} className="w-56 shrink-0 space-y-4">
      <ul className="space-y-1">
        {item({ kind: "all" }, t("view.all"), counts.all)}
        {item({ kind: "unsorted" }, t("view.unsorted"), counts.unsorted)}
        {item({ kind: "ai" }, t("view.ai"), counts.ai)}
        {item({ kind: "removed" }, t("view.removed"), counts.removed)}
      </ul>
      <div>
        <h2 className="px-3 text-xs font-bold text-stone-500">{t("view.folders")}</h2>
        <ul className="mt-1 space-y-1">{folders.map((f) => item({ kind: "folder", folderId: f.id }, f.name, counts.folders[f.id] ?? 0))}</ul>
      </div>
      <ul>{item({ kind: "hidden" }, t("view.hidden"), counts.hidden)}</ul>
    </nav>
  );
}
```

`src/dashboard/ReviewStrip.tsx`:

```tsx
import { useEffect } from "react";
import { localDateString, remainingReviewIds } from "../core/review";
import type { Folder, Post } from "../core/types";
import { addToFolder, setHidden } from "../db/posts";
import { completeReview, ensureTodayReview } from "../db/review-repo";
import { t } from "../i18n";
import { requestBadgeRefresh } from "./badge";
import { useSettings } from "./data";
import { useDb } from "./db-context";
import { useRun } from "./errors";
import { PostCard } from "./PostCard";

const BUTTON = "rounded-lg bg-amber-700 px-3 py-1 text-sm text-white dark:bg-amber-600";
const SUBTLE = "rounded-lg px-3 py-1 text-sm hover:bg-amber-200 dark:hover:bg-stone-700";

/** 今日の積みツイ崩し（過去のブクマを毎日少しずつ見返す） */
export function ReviewStrip({ posts, folders }: { posts: Map<string, Post>; folders: Folder[] }) {
  const db = useDb();
  const run = useRun();
  const settings = useSettings();
  const today = localDateString(new Date());

  useEffect(() => {
    void run(async () => {
      await ensureTodayReview(db, today);
      requestBadgeRefresh();
    });
  }, [db, today, run]);

  const review = settings?.todayReview?.date === today ? settings.todayReview : undefined;
  if (!review || review.postIds.length === 0) return null;

  const remaining = remainingReviewIds(review)
    .map((id) => posts.get(id))
    .filter((p): p is Post => p !== undefined && !p.hidden);
  const folderMap = new Map(folders.map((f) => [f.id, f]));

  const finish = (postId: string, before?: () => Promise<void>) =>
    void run(async () => {
      if (before) await before();
      await completeReview(db, postId, today, new Date().toISOString());
      requestBadgeRefresh();
    });

  return (
    <section aria-label={t("review.title")} className="rounded-2xl bg-amber-100 p-4 dark:bg-stone-800">
      <h2 className="font-bold">
        {t("review.title")}
        <span className="ml-2 text-sm font-normal text-stone-600 dark:text-stone-400">{t("review.left", { count: remaining.length })}</span>
      </h2>
      {remaining.length === 0 ? (
        <p className="mt-2">{t("review.done")}</p>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {remaining.map((post) => (
            <PostCard key={post.id} post={post} folders={folderMap}>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={BUTTON} onClick={() => finish(post.id)}>
                  {t("review.seen")}
                </button>
                {folders.length > 0 && (
                  <select
                    aria-label={t("review.toFolder")}
                    value=""
                    onChange={(e) => {
                      const folderId = e.target.value;
                      if (folderId) finish(post.id, () => addToFolder(db, [post.id], folderId));
                    }}
                    className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-sm dark:border-stone-600 dark:bg-stone-900"
                  >
                    <option value="">{t("review.toFolder")}</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                )}
                <button type="button" className={SUBTLE} onClick={() => finish(post.id, () => setHidden(db, [post.id], true))}>
                  {t("review.hide")}
                </button>
              </div>
            </PostCard>
          ))}
        </div>
      )}
    </section>
  );
}
```

`src/dashboard/Shelf.tsx`:

```tsx
import { useMemo, useState } from "react";
import { selectPosts, SORT_KEYS, viewCounts, type SortKey, type View } from "../core/views";
import { addToFolder, removeFromFolder, setHidden } from "../db/posts";
import { t } from "../i18n";
import { BulkBar } from "./BulkBar";
import { useFolders, usePosts } from "./data";
import { useDb } from "./db-context";
import { useRun } from "./errors";
import { SORT_LABEL } from "./labels";
import { PostCard } from "./PostCard";
import { ReviewStrip } from "./ReviewStrip";
import { Sidebar } from "./Sidebar";

export const SHELF_PAGE_SIZE = 100;
const FIELD = "rounded-lg border border-amber-300 bg-white px-3 py-1.5 dark:border-stone-600 dark:bg-stone-800";

/** 「本棚」タブ */
export function Shelf() {
  const db = useDb();
  const run = useRun();
  const posts = usePosts();
  const folders = useFolders();
  const [view, setView] = useState<View>({ kind: "all" });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("bookmark-desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(SHELF_PAGE_SIZE);

  const list = useMemo(() => selectPosts(posts ?? [], { view, query, sort }), [posts, view, query, sort]);
  const counts = useMemo(() => viewCounts(posts ?? []), [posts]);
  const postMap = useMemo(() => new Map((posts ?? []).map((p) => [p.id, p])), [posts]);
  const folderMap = useMemo(() => new Map((folders ?? []).map((f) => [f.id, f])), [folders]);

  if (!posts || !folders) return null;

  const changeView = (v: View) => {
    setView(v);
    setSelected(new Set());
    setLimit(SHELF_PAGE_SIZE);
  };
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const ids = [...selected];

  return (
    <div className="flex gap-6">
      <Sidebar view={view} onChange={changeView} counts={counts} folders={folders} />
      <main className="min-w-0 flex-1 space-y-4">
        <ReviewStrip posts={postMap} folders={folders} />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(SHELF_PAGE_SIZE);
            }}
            placeholder={t("shelf.search")}
            aria-label={t("shelf.search")}
            className={`${FIELD} min-w-48 flex-1`}
          />
          <select aria-label={t("shelf.sort")} value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={FIELD}>
            {SORT_KEYS.map((k) => (
              <option key={k} value={k}>
                {t(SORT_LABEL[k])}
              </option>
            ))}
          </select>
          <span className="text-sm text-stone-500">{t("shelf.count", { count: list.length })}</span>
        </div>
        {selected.size > 0 && (
          <BulkBar
            count={selected.size}
            folders={folders}
            hiddenView={view.kind === "hidden"}
            onAdd={(folderId) => void run(() => addToFolder(db, ids, folderId))}
            onRemove={(folderId) => void run(() => removeFromFolder(db, ids, folderId))}
            onToggleHidden={() =>
              void run(async () => {
                await setHidden(db, ids, view.kind !== "hidden");
                setSelected(new Set());
              })
            }
            onClear={() => setSelected(new Set())}
          />
        )}
        <ul aria-label={t("shelf.list")} className="space-y-3">
          {list.slice(0, limit).map((p) => (
            <li key={p.id}>
              <PostCard post={p} folders={folderMap} selected={selected.has(p.id)} onSelect={(on) => toggle(p.id, on)} />
            </li>
          ))}
        </ul>
        {list.length === 0 && <p className="rounded-xl bg-white p-6 text-stone-600 dark:bg-stone-800 dark:text-stone-300">{t("shelf.empty")}</p>}
        {list.length > limit && (
          <button type="button" className="w-full rounded-xl bg-amber-100 py-2 hover:bg-amber-200 dark:bg-stone-800 dark:hover:bg-stone-700" onClick={() => setLimit((l) => l + SHELF_PAGE_SIZE)}>
            {t("shelf.more", { count: list.length - limit })}
          </button>
        )}
      </main>
    </div>
  );
}
```

（一覧の `aria-label`「投稿の一覧」は画面に出ない読み上げ用のラベルで、テストで一覧を探す目印にも使う）

- [ ] **Step 4: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし

`Shelf.test.tsx` が `useLiveQuery` の更新待ちで不安定（ときどき落ちる）なら、`waitFor` の `timeout` を `{ timeout: 3000 }` に延ばす。それでも落ちる場合は、テストの意図（表示・絞り込み・DB への反映）を変えずに原因を調べて直し、報告する。

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/Sidebar.tsx src/dashboard/ReviewStrip.tsx src/dashboard/Shelf.tsx src/dashboard/Shelf.test.tsx
git commit -m "本棚: 本棚タブ（絞り込み・検索・まとめて操作・今日の積みツイ崩し）" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 「フォルダとルール」タブ

**Files:**
- Create: `src/dashboard/FolderEditor.tsx`, `src/dashboard/RuleEditor.tsx`, `src/dashboard/Organize.tsx`
- Test: `src/dashboard/Organize.test.tsx`

**Interfaces:**
- Consumes: Task 1〜3、`createFolder`・`updateFolder`・`reorderFolders`・`deleteFolder`・`FolderNameError`・`saveRule`・`deleteRule`・`applyRulesToUnsorted`（計画1）
- Produces: `FolderEditor()`、`RuleEditor()`、`Organize()`

- [ ] **Step 1: 失敗するテストを書く**

`src/dashboard/Organize.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makePost } from "../test/factories";
import { openTestDb } from "../test/db";
import { DbProvider } from "./db-context";
import { Organize } from "./Organize";

const db = openTestDb();
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await Promise.all([db.posts.clear(), db.folders.clear(), db.rules.clear(), db.kv.clear()]);
});

function renderOrganize() {
  render(
    <DbProvider value={db}>
      <Organize />
    </DbProvider>,
  );
}

describe("フォルダの編集", () => {
  it("作る・重複は理由を出す", async () => {
    renderOrganize();
    const input = await screen.findByLabelText("新しいフォルダの名前");
    fireEvent.change(input, { target: { value: "ゲーム" } });
    fireEvent.click(screen.getByRole("button", { name: "追加" }));
    const row = await screen.findByRole("textbox", { name: "フォルダの名前" });
    expect((row as HTMLInputElement).value).toBe("ゲーム");
    fireEvent.change(input, { target: { value: "ｹﾞｰﾑ" } });
    fireEvent.click(screen.getByRole("button", { name: "追加" }));
    expect((await screen.findByRole("alert")).textContent).toBe("同じ名前のフォルダがあります");
  });

  it("名前を重複する名前に変えると理由を出して元に戻す", async () => {
    await db.folders.bulkPut([
      { id: "a", name: "A", description: "", order: 0, createdAt: "" },
      { id: "b", name: "B", description: "", order: 1, createdAt: "" },
    ]);
    renderOrganize();
    const inputs = await screen.findAllByRole("textbox", { name: "フォルダの名前" });
    const b = inputs[1] as HTMLInputElement;
    fireEvent.change(b, { target: { value: "A" } });
    fireEvent.blur(b);
    expect((await screen.findByRole("alert")).textContent).toBe("同じ名前のフォルダがあります");
    await waitFor(() => expect(b.value).toBe("B"));
    expect((await db.folders.get("b"))?.name).toBe("B");
  });

  it("確認してから削除する", async () => {
    await db.folders.put({ id: "a", name: "A", description: "", order: 0, createdAt: "" });
    renderOrganize();
    await screen.findByRole("textbox", { name: "フォルダの名前" });
    vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    expect(await db.folders.get("a")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    await waitFor(async () => expect(await db.folders.get("a")).toBeUndefined());
  });
});

describe("ルールの編集", () => {
  it("値が空なら保存しない。入れれば保存し、今すぐ適用で振り分ける", async () => {
    await db.folders.put({ id: "a", name: "ゲーム", description: "", order: 0, createdAt: "" });
    await db.posts.put(makePost({ id: "1", text: "Unity 講座" }));
    renderOrganize();
    const save = await screen.findByRole("button", { name: "ルールを追加" });
    fireEvent.click(save);
    expect(await screen.findByText("条件の値を入れてください")).toBeTruthy();
    expect(await db.rules.count()).toBe(0);

    fireEvent.change(screen.getByLabelText("本文に含む"), { target: { value: "unity" } });
    fireEvent.click(save);
    await waitFor(async () => expect(await db.rules.count()).toBe(1));
    fireEvent.click(screen.getByRole("button", { name: "未整理に今すぐ適用" }));
    expect(await screen.findByText("1 件を振り分けました")).toBeTruthy();
    expect((await db.posts.get("1"))?.folders).toEqual([{ folderId: "a", by: "rule" }]);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/dashboard/Organize.test.tsx`
Expected: FAIL（`./Organize` が見つからない）

- [ ] **Step 3: 実装する**

`src/dashboard/FolderEditor.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from "react";
import { moveItem } from "../core/move";
import type { Folder } from "../core/types";
import { createFolder, deleteFolder, FolderNameError, reorderFolders, updateFolder } from "../db/folders";
import { t } from "../i18n";
import { useFolders } from "./data";
import { useDb } from "./db-context";
import { useRun } from "./errors";
import { FOLDER_ERROR_LABEL } from "./labels";

const FIELD = "rounded-lg border border-amber-300 bg-white px-3 py-1.5 dark:border-stone-600 dark:bg-stone-900";
const BUTTON = "rounded-lg bg-amber-700 px-3 py-1.5 text-white dark:bg-amber-600";
const SUBTLE = "rounded-lg px-2 py-1 hover:bg-amber-100 disabled:opacity-30 dark:hover:bg-stone-700";

function FolderRow({ folder, index, total, onMove }: { folder: Folder; index: number; total: number; onMove(delta: number): void }) {
  const db = useDb();
  const run = useRun();
  const [name, setName] = useState(folder.name);
  const [description, setDescription] = useState(folder.description);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(folder.name);
    setDescription(folder.description);
  }, [folder.name, folder.description]);

  const save = () => {
    if (name === folder.name && description === folder.description) return;
    void run(async () => {
      try {
        await updateFolder(db, folder.id, { name, description });
        setError(null);
      } catch (e) {
        if (!(e instanceof FolderNameError)) throw e;
        setError(t(FOLDER_ERROR_LABEL[e.code]));
        setName(folder.name);
      }
    });
  };

  const remove = () => {
    if (!window.confirm(t("folders.confirmDelete", { name: folder.name }))) return;
    void run(() => deleteFolder(db, folder.id));
  };

  return (
    <li className="space-y-2 rounded-xl border border-amber-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-800">
      <div className="flex items-center gap-2">
        <input
          aria-label={t("folders.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          className={`${FIELD} min-w-0 flex-1`}
        />
        <button type="button" className={SUBTLE} aria-label={t("folders.up")} disabled={index === 0} onClick={() => onMove(-1)}>
          ↑
        </button>
        <button type="button" className={SUBTLE} aria-label={t("folders.down")} disabled={index === total - 1} onClick={() => onMove(1)}>
          ↓
        </button>
        <button type="button" className={SUBTLE} onClick={remove}>
          {t("folders.delete")}
        </button>
      </div>
      <input
        aria-label={t("folders.description")}
        placeholder={t("folders.description")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={save}
        className={`${FIELD} w-full text-sm`}
      />
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </li>
  );
}

/** フォルダの作成・名前と説明の変更・並べ替え・削除 */
export function FolderEditor() {
  const db = useDb();
  const run = useRun();
  const folders = useFolders();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!folders) return null;

  const create = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      try {
        await createFolder(db, { name }, new Date().toISOString());
        setName("");
        setError(null);
      } catch (err) {
        if (!(err instanceof FolderNameError)) throw err;
        setError(t(FOLDER_ERROR_LABEL[err.code]));
      }
    });
  };

  const move = (index: number, delta: number) =>
    void run(() => reorderFolders(db, moveItem(folders.map((f) => f.id), index, index + delta)));

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{t("folders.title")}</h2>
      <form onSubmit={create} className="flex gap-2">
        <input
          aria-label={t("folders.new")}
          placeholder={t("folders.new")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${FIELD} min-w-0 flex-1`}
        />
        <button type="submit" className={BUTTON}>
          {t("folders.add")}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {folders.length === 0 ? (
        <p className="text-stone-500">{t("folders.none")}</p>
      ) : (
        <ul className="space-y-2">
          {folders.map((f, i) => (
            <FolderRow key={f.id} folder={f} index={i} total={folders.length} onMove={(delta) => move(i, delta)} />
          ))}
        </ul>
      )}
    </section>
  );
}
```

`src/dashboard/RuleEditor.tsx`:

```tsx
import { useState, type FormEvent } from "react";
import { CONDITION_KINDS, conditionValue, draftToCondition, emptyDraft, MEDIA_CHOICES, type ConditionDraft, type ConditionKind } from "../core/condition-input";
import type { Condition } from "../core/types";
import { applyRulesToUnsorted, deleteRule, saveRule } from "../db/rules-repo";
import { t } from "../i18n";
import { useFolders, useRules } from "./data";
import { useDb } from "./db-context";
import { useRun } from "./errors";
import { COND_LABEL, MEDIA_LABEL } from "./labels";

const FIELD = "rounded-lg border border-amber-300 bg-white px-2 py-1.5 dark:border-stone-600 dark:bg-stone-900";
const BUTTON = "rounded-lg bg-amber-700 px-3 py-1.5 text-white dark:bg-amber-600";
const SUBTLE = "rounded-lg px-3 py-1.5 hover:bg-amber-100 dark:hover:bg-stone-700";

function ConditionRow({ draft, onChange, onRemove }: { draft: ConditionDraft; onChange(d: ConditionDraft): void; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <select aria-label={t("rules.kind")} value={draft.kind} onChange={(e) => onChange(emptyDraft(e.target.value as ConditionKind))} className={FIELD}>
        {CONDITION_KINDS.map((k) => (
          <option key={k} value={k}>
            {t(COND_LABEL[k])}
          </option>
        ))}
      </select>
      {draft.kind === "hasMedia" ? (
        <select aria-label={t(COND_LABEL.hasMedia)} value={draft.value} onChange={(e) => onChange({ ...draft, value: e.target.value })} className={FIELD}>
          {MEDIA_CHOICES.map((m) => (
            <option key={m} value={m}>
              {t(MEDIA_LABEL[m])}
            </option>
          ))}
        </select>
      ) : (
        <input aria-label={t(COND_LABEL[draft.kind])} value={draft.value} onChange={(e) => onChange({ ...draft, value: e.target.value })} className={`${FIELD} min-w-0 flex-1`} />
      )}
      {onRemove && (
        <button type="button" className={SUBTLE} aria-label={t("rules.removeCondition")} onClick={onRemove}>
          ×
        </button>
      )}
    </div>
  );
}

function describeCondition(c: Condition): string {
  return `${t(COND_LABEL[c.kind])}: ${c.kind === "hasMedia" ? t(MEDIA_LABEL[c.media]) : conditionValue(c)}`;
}

/** 自動振り分けのルールの一覧・追加・有効無効・削除・未整理への適用 */
export function RuleEditor() {
  const db = useDb();
  const run = useRun();
  const folders = useFolders();
  const rules = useRules();
  const [folderId, setFolderId] = useState("");
  const [drafts, setDrafts] = useState<ConditionDraft[]>([emptyDraft()]);
  const [message, setMessage] = useState<string | null>(null);

  if (!folders || !rules) return null;
  const folderMap = new Map(folders.map((f) => [f.id, f]));
  const target = folderId || folders[0]?.id || "";

  const save = (e: FormEvent) => {
    e.preventDefault();
    const conditions = drafts.map(draftToCondition).filter((c): c is Condition => c !== null);
    if (!target || conditions.length !== drafts.length || conditions.length === 0) {
      setMessage(t("rules.invalid"));
      return;
    }
    void run(async () => {
      await saveRule(db, { folderId: target, conditions, enabled: true });
      setDrafts([emptyDraft()]);
      setMessage(null);
    });
  };

  const applyNow = () =>
    void run(async () => {
      const count = await applyRulesToUnsorted(db);
      setMessage(t("rules.applied", { count }));
    });

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{t("rules.title")}</h2>
      <p className="text-sm text-stone-600 dark:text-stone-400">{t("rules.help")}</p>
      {rules.length === 0 ? (
        <p className="text-stone-500">{t("rules.none")}</p>
      ) : (
        <ul className="space-y-2">
          {rules.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-white p-3 text-sm dark:border-stone-700 dark:bg-stone-800">
              <span className="font-bold">{folderMap.get(r.folderId)?.name}</span>
              <span>←</span>
              {r.conditions.map((c, i) => (
                <span key={i} className="rounded-full bg-amber-100 px-2 py-0.5 dark:bg-stone-700">
                  {describeCondition(c)}
                </span>
              ))}
              <label className="ml-auto flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => void run(() => saveRule(db, { id: r.id, folderId: r.folderId, conditions: r.conditions, enabled: e.target.checked }))}
                />
                {t("rules.enabled")}
              </label>
              <button type="button" className={SUBTLE} onClick={() => void run(() => deleteRule(db, r.id))}>
                {t("rules.delete")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {folders.length === 0 ? (
        <p className="text-stone-500">{t("rules.needFolder")}</p>
      ) : (
        <form onSubmit={save} className="space-y-2 rounded-xl bg-amber-100 p-3 dark:bg-stone-800">
          <label className="flex items-center gap-2">
            {t("rules.folder")}
            <select value={target} onChange={(e) => setFolderId(e.target.value)} className={FIELD}>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          {drafts.map((d, i) => (
            <ConditionRow
              key={i}
              draft={d}
              onChange={(next) => setDrafts((ds) => ds.map((x, j) => (j === i ? next : x)))}
              onRemove={drafts.length > 1 ? () => setDrafts((ds) => ds.filter((_, j) => j !== i)) : undefined}
            />
          ))}
          <div className="flex gap-2">
            <button type="button" className={SUBTLE} onClick={() => setDrafts((ds) => [...ds, emptyDraft()])}>
              {t("rules.addCondition")}
            </button>
            <button type="submit" className={BUTTON}>
              {t("rules.save")}
            </button>
          </div>
        </form>
      )}
      <button type="button" className={SUBTLE} onClick={applyNow}>
        {t("rules.applyNow")}
      </button>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
```

`src/dashboard/Organize.tsx`:

```tsx
import { FolderEditor } from "./FolderEditor";
import { RuleEditor } from "./RuleEditor";

/** 「フォルダとルール」タブ */
export function Organize() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <FolderEditor />
      <RuleEditor />
    </div>
  );
}
```

- [ ] **Step 4: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/FolderEditor.tsx src/dashboard/RuleEditor.tsx src/dashboard/Organize.tsx src/dashboard/Organize.test.tsx
git commit -m "本棚: フォルダとルールの編集タブ" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 「設定」タブと全体の枠

**Files:**
- Create: `src/config.ts`, `src/dashboard/SettingsPanel.tsx`, Test: `src/dashboard/SettingsPanel.test.tsx`
- Modify: `src/entrypoints/dashboard/App.tsx`（全体を置き換え）
- Modify: `docs/manual-test.md`、`task.md`

**Interfaces:**
- Consumes: Task 1〜5、`exportAll`・`importFile`（計画1）、`parseImport`（計画1）、`updateSettings`（計画1）、`hasParseWarning`（計画2）
- Produces: `LINKS: { privacy: string; donate: string }`（`src/config.ts`）、`SettingsPanel()`、`App()`

- [ ] **Step 1: 失敗するテストを書く**

`src/dashboard/SettingsPanel.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildExport } from "../core/export-format";
import { getSettings } from "../db/settings";
import { makePost } from "../test/factories";
import { openTestDb } from "../test/db";
import { DbProvider } from "./db-context";
import { SettingsPanel } from "./SettingsPanel";

const db = openTestDb();
afterEach(async () => {
  cleanup();
  await Promise.all([db.posts.clear(), db.folders.clear(), db.rules.clear(), db.kv.clear()]);
});

function renderPanel() {
  render(
    <DbProvider value={db}>
      <SettingsPanel />
    </DbProvider>,
  );
}

function upload(text: string) {
  const input = screen.getByLabelText("読み込む") as HTMLInputElement;
  const file = new File([text], "backup.json", { type: "application/json" });
  fireEvent.change(input, { target: { files: [file] } });
}

describe("SettingsPanel", () => {
  it("メニューの表示を切り替えると保存する", async () => {
    renderPanel();
    const box = await screen.findByLabelText("ブクマした瞬間にフォルダ選択メニューを出す");
    fireEvent.click(box);
    await waitFor(async () => expect((await getSettings(db)).pickerOnBookmark).toBe(false));
  });

  it("ツイッ棚の書き出しファイルを読み込み、結果を出す", async () => {
    renderPanel();
    await screen.findByLabelText("読み込む");
    upload(JSON.stringify(buildExport({ folders: [], rules: [], posts: [makePost({ id: "1" })] }, "2026-10-02T00:00:00.000Z")));
    expect(await screen.findByText("読み込みました：投稿 1 件・新しいフォルダ 0 個・新しいルール 0 個")).toBeTruthy();
    expect(await db.posts.get("1")).toBeDefined();
  });

  it("別のファイルは何も変えずに理由を出す", async () => {
    renderPanel();
    await screen.findByLabelText("読み込む");
    upload(JSON.stringify({ app: "other" }));
    expect(await screen.findByText("ツイッ棚の書き出しファイルではありません")).toBeTruthy();
    expect(await db.posts.count()).toBe(0);
  });

  it("読み取りの調子が悪いときは警告を出す", async () => {
    await db.kv.put({ key: "settings", value: { parseHealth: { lastErrorAt: "2026-10-02T00:00:00.000Z", lastErrorOp: "Bookmarks" } } });
    renderPanel();
    expect((await screen.findByRole("alert")).textContent).toContain("Bookmarks");
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/dashboard/SettingsPanel.test.tsx`
Expected: FAIL（`./SettingsPanel` が見つからない）

- [ ] **Step 3: 実装する**

`src/config.ts`:

```ts
/** 設定画面に出すリンク。空文字なら出さない（寄付の受け皿はユーザーが用意する） */
export const LINKS = {
  privacy: "",
  donate: "",
};
```

`src/dashboard/SettingsPanel.tsx`:

```tsx
import { useState } from "react";
import { LINKS } from "../config";
import { parseImport } from "../core/export-format";
import { hasParseWarning } from "../core/health";
import { localDateString } from "../core/review";
import { exportAll, importFile } from "../db/backup";
import { updateSettings } from "../db/settings";
import { t } from "../i18n";
import { usePostCount, useSettings } from "./data";
import { useDb } from "./db-context";
import { useRun } from "./errors";
import { IMPORT_ERROR_LABEL } from "./labels";

const BUTTON = "rounded-lg bg-amber-700 px-3 py-1.5 text-white dark:bg-amber-600";
const LINK = "text-amber-800 underline dark:text-amber-300";

/** 「設定」タブ */
export function SettingsPanel() {
  const db = useDb();
  const run = useRun();
  const settings = useSettings();
  const total = usePostCount();
  const [message, setMessage] = useState<string | null>(null);

  if (!settings) return null;

  const doExport = () =>
    void run(async () => {
      const file = await exportAll(db, new Date().toISOString());
      const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `twittana-${localDateString(new Date())}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

  const doImport = (file: File | undefined) => {
    if (!file) return;
    void run(async () => {
      const result = parseImport(await file.text());
      if (!result.ok) {
        setMessage(t(IMPORT_ERROR_LABEL[result.error]));
        return;
      }
      setMessage(t("settings.imported", await importFile(db, result.file)));
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      {hasParseWarning(settings.parseHealth) && (
        <p role="alert" className="rounded-xl bg-red-100 px-4 py-3 text-red-900 dark:bg-red-950 dark:text-red-100">
          {t("settings.health.warning", { op: settings.parseHealth.lastErrorOp ?? "?" })}
        </p>
      )}
      <p>{t("settings.stats", { count: total ?? 0 })}</p>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="h-4 w-4 accent-amber-700"
          checked={settings.pickerOnBookmark}
          onChange={(e) => void run(() => updateSettings(db, { pickerOnBookmark: e.target.checked }))}
        />
        {t("settings.picker")}
      </label>
      <label className="flex items-center gap-2">
        {t("settings.reviewPerDay")}
        <input
          type="number"
          min={1}
          max={20}
          value={settings.reviewPerDay}
          onChange={(e) => {
            const n = Math.min(20, Math.max(1, Math.round(Number(e.target.value)) || 1));
            void run(() => updateSettings(db, { reviewPerDay: n }));
          }}
          className="w-20 rounded-lg border border-amber-300 bg-white px-2 py-1 dark:border-stone-600 dark:bg-stone-900"
        />
      </label>
      <section className="space-y-2">
        <h2 className="text-lg font-bold">{t("settings.backup")}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={BUTTON} onClick={doExport}>
            {t("settings.export")}
          </button>
          <label className="flex items-center gap-2">
            {t("settings.import")}
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                doImport(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {message && <p role="status">{message}</p>}
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-bold">{t("settings.about")}</h2>
        <p className="text-sm text-stone-600 dark:text-stone-400">{t("app.unofficial")}</p>
        <div className="flex gap-4">
          {LINKS.privacy && (
            <a href={LINKS.privacy} target="_blank" rel="noopener noreferrer" className={LINK}>
              {t("settings.privacy")}
            </a>
          )}
          {LINKS.donate && (
            <a href={LINKS.donate} target="_blank" rel="noopener noreferrer" className={LINK}>
              {t("settings.donate")}
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
```

`src/entrypoints/dashboard/App.tsx`（全体を置き換え）:

```tsx
import { useEffect, useState } from "react";
import { requestBadgeRefresh } from "../../dashboard/badge";
import { ErrorProvider } from "../../dashboard/errors";
import { Organize } from "../../dashboard/Organize";
import { SettingsPanel } from "../../dashboard/SettingsPanel";
import { Shelf } from "../../dashboard/Shelf";
import { t, type MessageKey } from "../../i18n";

type Tab = "shelf" | "organize" | "settings";
const TABS: { id: Tab; label: MessageKey }[] = [
  { id: "shelf", label: "tab.shelf" },
  { id: "organize", label: "tab.organize" },
  { id: "settings", label: "tab.settings" },
];

export function App() {
  const [tab, setTab] = useState<Tab>("shelf");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    requestBadgeRefresh();
  }, []);

  return (
    <ErrorProvider value={setError}>
      <div className="min-h-screen bg-amber-50 text-stone-800 dark:bg-stone-900 dark:text-stone-100">
        <header className="sticky top-0 z-20 border-b border-amber-200 bg-amber-50/95 backdrop-blur dark:border-stone-700 dark:bg-stone-900/95">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
            <h1 className="text-xl font-bold">{t("app.title")}</h1>
            <nav role="tablist" className="flex gap-1">
              {TABS.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === x.id}
                  onClick={() => setTab(x.id)}
                  className={`rounded-lg px-3 py-1.5 ${tab === x.id ? "bg-amber-200 font-bold dark:bg-stone-700" : "hover:bg-amber-100 dark:hover:bg-stone-800"}`}
                >
                  {t(x.label)}
                </button>
              ))}
            </nav>
          </div>
        </header>
        {error && (
          <div role="alert" className="mx-auto mt-4 flex max-w-6xl items-start gap-3 rounded-xl bg-red-100 px-4 py-3 text-red-900 dark:bg-red-950 dark:text-red-100">
            <p className="flex-1">{error}</p>
            <button type="button" className="underline" onClick={() => setError(null)}>
              {t("error.close")}
            </button>
          </div>
        )}
        <div className="mx-auto max-w-6xl px-6 py-6">
          {tab === "shelf" ? <Shelf /> : tab === "organize" ? <Organize /> : <SettingsPanel />}
        </div>
      </div>
    </ErrorProvider>
  );
}
```

- [ ] **Step 4: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし / `npm run build` → 成功

- [ ] **Step 5: 手で確かめる表に「本棚画面」を足す**

`docs/manual-test.md` の末尾に追記:

```markdown
## 本棚画面

| # | 操作 | 期待すること |
|---|---|---|
| 1 | 拡張アイコンを押す | 本棚画面が新しいタブで開く。もう一度押すと、同じタブに戻る |
| 2 | 「本棚」タブ | 取り込んだ投稿がブクマの新しい順に並ぶ。画像の縮小表示とアイコンが出る |
| 3 | 左の「未整理」「X で解除済み」、各フォルダ | それぞれの件数と一覧が合っている |
| 4 | 検索欄に全角・半角を混ぜて入れる | 同じ文字として見つかる |
| 5 | 2 件を選び、フォルダを選んで「入れる」 | 2 件にそのフォルダが付く（印なし＝手動） |
| 6 | 「非表示にする」→ 左の「非表示にしたもの」→「表示に戻す」 | 一覧から消え、戻すと元に戻る |
| 7 | 今日の積みツイ崩しで「見た」「フォルダへ入れる」「もう出さない」 | 残り件数が減り、拡張アイコンの数字も減る |
| 8 | 「フォルダとルール」でフォルダを作る・改名・説明・並べ替え・削除 | 本棚の左の一覧に反映される。重複する名前は理由が出る |
| 9 | ルールを作り「未整理に今すぐ適用」 | 当たる投稿に「ルール」の印つきでフォルダが付く |
| 10 | X のブクマ画面でスクロールしながら本棚画面を見る | 本棚画面の件数が自動で増える |
| 11 | 「設定」で書き出し → 拡張を一度削除して入れ直す → 読み込み | 投稿・フォルダ・ルールが元に戻る |
| 12 | 「設定」でメニューの表示をオフにして X でブクマ | メニューが出ない（取り込みはされる） |
| 13 | OS を暗い配色にする | 本棚画面も暗い配色になり、文字が読める |
```

- [ ] **Step 6: task.md を更新して Commit・push**

`task.md` の計画3の行を `- [x] 計画3：本棚画面（docs/superpowers/plans/2026-10-02-twittana-c-shelf.md）` にし、手での確認の行を `- [ ] 計画2・3の手での確認（docs/manual-test.md）。実際の X アカウントが要るのでユーザーが行う` に書き換える。

```bash
git add src/config.ts src/dashboard/SettingsPanel.tsx src/dashboard/SettingsPanel.test.tsx src/entrypoints/dashboard/App.tsx docs/manual-test.md task.md
git commit -m "本棚: 設定タブと画面全体の枠" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```
