# ツイッ棚 計画4：AI 分類・英語・公開準備 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chrome 内蔵 AI による未整理の自動振り分け、英語表示、アイコン、プライバシーポリシー、ストア掲載文、X の仕様変更に備える開発用の道具を作り、第1弾を公開できる状態にする。

**Architecture:** AI への指示文の組み立てと返事の解釈、処理の進め方は `src/core/` の純粋関数（ブラウザ API は引数で渡す）。ブラウザの `LanguageModel` を触るのは `src/ai/language-model.ts` だけ。AI は本棚画面を開いている間だけ動く（設計書 9 章）。言語は `t()` が今の言語の辞書を引く形にし、本棚画面と x.com 上の画面の両方で設定に従う。

**Tech Stack:** 計画1〜3と同じ ＋ sharp（アイコンの PNG 作成用、開発時のみ）

**Spec:** [`docs/superpowers/specs/2026-10-02-twittana-design.md`](../specs/2026-10-02-twittana-design.md)（9 章の AI、12 章の言語・プライバシーポリシー、14 章のテスト用データ、15 章）

**前提:** 計画1〜3 が完了していること。計画2・3で作ったファイルを変更するタスクがある（その時点の中身を読んでから直す）。

## Global Constraints

- 計画1〜3の Global Constraints をすべて守る
- AI はブラウザ内蔵の `LanguageModel`（Prompt API）だけを使う。外部の AI サービスへは送らない
- AI は「手で整理していない・どのフォルダにも入っていない・非表示でない・中身のある」投稿にだけ、`by: "ai"` で 1 つのフォルダを入れる。自信が `high` でなければ入れない
- 英語の辞書は日本語の辞書と同じキーをすべて持つ（型で強制する）
- アイコンに X のロゴや青い鳥を使わない（本棚の絵にする）
- テスト用の実データは匿名化してからでないとコミットしない（リポジトリは公開）

## Review Focus

- AI が辞書にないフォルダ名や壊れた JSON を返す → 何も入れずに未整理のまま残すべき（Task 1 のテスト）
- 処理中に利用者がその投稿を手で整理した → AI の結果で上書きしないべき（Task 2 のテスト）
- AI のエラーが続く（モデルが壊れた・PC の負荷が高い）→ 5 件続けて失敗したら止まり、同じ投稿で無限に繰り返さないべき（Task 2 のテスト）
- `LanguageModel` が無いブラウザ（Edge・古い Chrome）→ 例外を出さず「使えません」と表示すべき（Task 3 のテスト）
- 言語を英語にしても一部が日本語のまま／x.com 上のメニューだけ日本語 → どちらも設定に従うべき（Task 5 のテスト）

---

## File Structure

| ファイル | 役割 |
|---|---|
| `src/core/ai-prompt.ts` | AI への指示文・返事の形（JSON Schema）・返事の解釈 |
| `src/core/ai-runner.ts` | 未整理を順番に AI にかける進め方（失敗が続いたら止める） |
| `src/db/ai-repo.ts` | AI にかける投稿の選び方、フォルダと手動の例、結果の記録 |
| `src/ai/language-model.ts` | ブラウザの `LanguageModel` を包む（使えるか・準備・分類） |
| `src/dashboard/useAiSorter.ts` | 本棚画面で AI を動かすフック |
| `src/dashboard/AiStatus.tsx` | 本棚タブの AI の状態とボタン |
| `src/dashboard/AiSettings.tsx` | 設定タブの AI の項目 |
| `src/i18n/en.ts`、`src/i18n/index.ts`（変更） | 英語の辞書と、言語の切り替え |
| `public/_locales/{ja,en}/messages.json` | 拡張の名前・説明の多言語化 |
| `src/assets/icon.svg`、`scripts/make-icons.mjs`、`public/icon/*.png` | アイコン |
| `docs/index.html`、`docs/privacy.html`、`docs/.nojekyll` | GitHub Pages で出す紹介ページとプライバシーポリシー |
| `docs/store/listing.md` | Chrome ウェブストアの掲載文と審査用の説明 |
| `src/devtools/anonymize.ts`、`scripts/anonymize-fixture.ts`、`docs/maintenance.md` | X の返事の保存と匿名化（仕様変更への備え） |

---

### Task 1: AI への指示文と返事の解釈

**Files:**
- Create: `src/core/ai-prompt.ts`, Test: `src/core/ai-prompt.test.ts`

**Interfaces:**
- Consumes: `Post`（計画1）
- Produces: `AI_SYSTEM_PROMPT: string`、`AI_NONE = "(none)"`、`AI_TEXT_LIMIT = 500`、`AI_EXAMPLE_TEXT_LIMIT = 120`、`AI_EXAMPLES_PER_FOLDER = 2`、`AI_PROMPT_SOFT_LIMIT = 3000`、`type AiFolder = { id: string; name: string; description: string; examples: string[] }`、`truncate(s: string, limit: number): string`、`classifySchema(folderNames: string[]): object`、`buildClassifyPrompt(post: Post, folders: AiFolder[], opts: { withExamples: boolean }): string`、`interpretClassify(raw: string, folders: { id: string; name: string }[]): string | null`

- [ ] **Step 1: 失敗するテストを書く**

`src/core/ai-prompt.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makePost } from "../test/factories";
import { AI_NONE, AI_TEXT_LIMIT, buildClassifyPrompt, classifySchema, interpretClassify, truncate, type AiFolder } from "./ai-prompt";

const folders: AiFolder[] = [
  { id: "a", name: "ゲーム開発", description: "Unity や Unreal の技術メモ", examples: ["Unity の Shader Graph 入門"] },
  { id: "b", name: "料理", description: "", examples: [] },
];

describe("truncate", () => {
  it("長ければ切って … をつける", () => {
    expect(truncate("あいうえお", 3)).toBe("あいう…");
    expect(truncate("あい", 3)).toBe("あい");
  });
});

describe("classifySchema", () => {
  it("フォルダ名か (none) だけ、自信は high か low だけを許す", () => {
    expect(classifySchema(["ゲーム開発", "料理"])).toEqual({
      type: "object",
      properties: {
        folder: { type: "string", enum: ["ゲーム開発", "料理", AI_NONE] },
        confidence: { type: "string", enum: ["high", "low"] },
      },
      required: ["folder", "confidence"],
      additionalProperties: false,
    });
  });
});

describe("buildClassifyPrompt", () => {
  const post = makePost({
    text: "あ".repeat(AI_TEXT_LIMIT + 50),
    hashtags: ["gamedev"],
    links: [{ url: "https://www.youtube.com/watch?v=1", domain: "youtube.com" }],
  });

  it("フォルダ名・説明・例と、投稿の要点（長い本文は切る）を入れる", () => {
    const prompt = buildClassifyPrompt(post, folders, { withExamples: true });
    expect(prompt).toContain('- "ゲーム開発": Unity や Unreal の技術メモ');
    expect(prompt).toContain('example: "Unity の Shader Graph 入門"');
    expect(prompt).toContain('- "料理"');
    expect(prompt).toContain("Author: @someone");
    expect(prompt).toContain("Hashtags: #gamedev");
    expect(prompt).toContain("Links: youtube.com");
    expect(prompt).toContain(`${"あ".repeat(AI_TEXT_LIMIT)}…`);
    expect(prompt).not.toContain("あ".repeat(AI_TEXT_LIMIT + 1));
  });

  it("例なしも作れる", () => {
    expect(buildClassifyPrompt(post, folders, { withExamples: false })).not.toContain("example:");
  });
});

describe("interpretClassify", () => {
  it("自信が high で、実在するフォルダ名ならその ID", () => {
    expect(interpretClassify('{"folder":"料理","confidence":"high"}', folders)).toBe("b");
  });
  it("自信が low・(none)・知らない名前・壊れた JSON なら null", () => {
    expect(interpretClassify('{"folder":"料理","confidence":"low"}', folders)).toBeNull();
    expect(interpretClassify(`{"folder":"${AI_NONE}","confidence":"high"}`, folders)).toBeNull();
    expect(interpretClassify('{"folder":"旅行","confidence":"high"}', folders)).toBeNull();
    expect(interpretClassify("料理です", folders)).toBeNull();
    expect(interpretClassify("null", folders)).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/core/ai-prompt.test.ts`
Expected: FAIL（`./ai-prompt` が見つからない）

- [ ] **Step 3: 実装する**

`src/core/ai-prompt.ts`:

```ts
import type { Post } from "./types";

export const AI_SYSTEM_PROMPT =
  'You sort saved social media posts into the user\'s folders. Pick the one folder whose name and description clearly fit the post. If no folder clearly fits, answer "(none)". Use "high" confidence only when you are sure. Answer with JSON only.';
export const AI_NONE = "(none)";
export const AI_TEXT_LIMIT = 500;
export const AI_EXAMPLE_TEXT_LIMIT = 120;
export const AI_EXAMPLES_PER_FOLDER = 2;
/** 指示文がこれより長ければ、例を外して短くする */
export const AI_PROMPT_SOFT_LIMIT = 3000;

/** AI に渡すフォルダ（説明と、利用者が手で入れた投稿の例つき） */
export type AiFolder = { id: string; name: string; description: string; examples: string[] };

export function truncate(s: string, limit: number): string {
  return s.length > limit ? `${s.slice(0, limit)}…` : s;
}

/** AI の返事の形。フォルダ名は実在するものか (none) だけに制限する */
export function classifySchema(folderNames: string[]): object {
  return {
    type: "object",
    properties: {
      folder: { type: "string", enum: [...folderNames, AI_NONE] },
      confidence: { type: "string", enum: ["high", "low"] },
    },
    required: ["folder", "confidence"],
    additionalProperties: false,
  };
}

export function buildClassifyPrompt(post: Post, folders: AiFolder[], opts: { withExamples: boolean }): string {
  const lines = ["Folders:"];
  for (const f of folders) {
    lines.push(f.description ? `- "${f.name}": ${f.description}` : `- "${f.name}"`);
    if (opts.withExamples) {
      for (const ex of f.examples.slice(0, AI_EXAMPLES_PER_FOLDER)) lines.push(`  example: "${truncate(ex, AI_EXAMPLE_TEXT_LIMIT)}"`);
    }
  }
  lines.push("", "Post:");
  lines.push(`Author: @${post.author.handle}${post.author.name ? ` (${post.author.name})` : ""}`);
  if (post.hashtags.length) lines.push(`Hashtags: ${post.hashtags.map((h) => `#${h}`).join(" ")}`);
  if (post.links.length) lines.push(`Links: ${[...new Set(post.links.map((l) => l.domain))].join(", ")}`);
  lines.push(`Text: ${truncate(post.text, AI_TEXT_LIMIT)}`);
  if (post.quoted) lines.push(`Quoted post: ${truncate(post.quoted.text, AI_EXAMPLE_TEXT_LIMIT)}`);
  return lines.join("\n");
}

/** AI の返事を解釈する。自信が high で実在するフォルダ名ならその ID、それ以外は null */
export function interpretClassify(raw: string, folders: { id: string; name: string }[]): string | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { folder, confidence } = value as { folder?: unknown; confidence?: unknown };
  if (confidence !== "high" || typeof folder !== "string" || folder === AI_NONE) return null;
  return folders.find((f) => f.name === folder)?.id ?? null;
}
```

- [ ] **Step 4: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし

- [ ] **Step 5: Commit**

```bash
git add src/core/ai-prompt.ts src/core/ai-prompt.test.ts
git commit -m "AI: 指示文の組み立てと返事の解釈" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: AI の進め方と結果の記録

**Files:**
- Create: `src/core/ai-runner.ts`, `src/db/ai-repo.ts`
- Test: `src/core/ai-runner.test.ts`, `src/db/ai-repo.test.ts`

**Interfaces:**
- Consumes: Task 1、`compareByBookmark`（計画1）、`listFolders`・`getSettings`（計画1）、`TwitTanaDB`（計画1）
- Produces（`ai-runner.ts`）: `AI_MAX_CONSECUTIVE_FAILURES = 5`、`type AiClassifier = (prompt: string, schema: object) => Promise<string>`、`type AiRunDeps = { folders(): Promise<AiFolder[]>; candidates(): Promise<Post[]>; classify: AiClassifier; record(postId: string, folderId: string | null): Promise<boolean>; shouldStop(): boolean; onProgress?(p: AiProgress): void }`、`type AiProgress = { done: number; sorted: number }`、`type AiRunResult = AiProgress & { stoppedByErrors: boolean }`、`runAiSorting(deps: AiRunDeps): Promise<AiRunResult>`
- Produces（`ai-repo.ts`）: `AI_BATCH_SIZE = 20`、`aiCandidates(db, foldersVersion: number, limit?: number): Promise<Post[]>`、`countAiCandidates(db, foldersVersion: number): Promise<number>`、`aiFolders(db): Promise<AiFolder[]>`、`recordAiResult(db, postId: string, folderId: string | null, foldersVersion: number): Promise<boolean>`

- [ ] **Step 1: 失敗するテストを書く**

`src/core/ai-runner.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { makePost } from "../test/factories";
import type { AiFolder } from "./ai-prompt";
import { AI_MAX_CONSECUTIVE_FAILURES, runAiSorting, type AiRunDeps } from "./ai-runner";
import type { Post } from "./types";

const folders: AiFolder[] = [{ id: "a", name: "ゲーム", description: "", examples: ["例"] }];

/** candidates() が、まだ記録していない投稿を返し続ける偽物 */
function fakeDeps(posts: Post[], classify: AiRunDeps["classify"]): AiRunDeps & { recorded: [string, string | null][] } {
  const recorded: [string, string | null][] = [];
  return {
    recorded,
    folders: async () => folders,
    candidates: async () => posts.filter((p) => !recorded.some(([id]) => id === p.id)).slice(0, 2),
    classify,
    record: async (postId, folderId) => {
      recorded.push([postId, folderId]);
      return folderId !== null;
    },
    shouldStop: () => false,
  };
}

describe("runAiSorting", () => {
  it("候補が無くなるまで順に分類して記録する", async () => {
    const posts = [makePost({ id: "1", text: "ゲーム" }), makePost({ id: "2", text: "料理" }), makePost({ id: "3", text: "ゲーム" })];
    const deps = fakeDeps(posts, async (prompt) => (prompt.includes("Text: ゲーム") ? '{"folder":"ゲーム","confidence":"high"}' : '{"folder":"(none)","confidence":"high"}'));
    const progress = vi.fn();
    const result = await runAiSorting({ ...deps, onProgress: progress });
    expect(result).toEqual({ done: 3, sorted: 2, stoppedByErrors: false });
    expect(deps.recorded).toEqual([
      ["1", "a"],
      ["2", null],
      ["3", "a"],
    ]);
    expect(progress).toHaveBeenLastCalledWith({ done: 3, sorted: 2 });
  });

  it("例つきで失敗したら例なしでもう一度試す", async () => {
    const classify = vi.fn(async (prompt: string) => {
      if (prompt.includes("example:")) throw new Error("長すぎ");
      return '{"folder":"ゲーム","confidence":"high"}';
    });
    const deps = fakeDeps([makePost({ id: "1" })], classify);
    expect(await runAiSorting(deps)).toEqual({ done: 1, sorted: 1, stoppedByErrors: false });
    expect(classify).toHaveBeenCalledTimes(2);
  });

  it("失敗した投稿は判定済み（null）にして先へ進み、続けて失敗したら止まる", async () => {
    const posts = Array.from({ length: AI_MAX_CONSECUTIVE_FAILURES + 3 }, (_, i) => makePost({ id: String(i + 1) }));
    const deps = fakeDeps(posts, async () => {
      throw new Error("壊れた");
    });
    const result = await runAiSorting(deps);
    expect(result).toEqual({ done: 0, sorted: 0, stoppedByErrors: true });
    expect(deps.recorded).toHaveLength(AI_MAX_CONSECUTIVE_FAILURES);
    expect(deps.recorded.every(([, f]) => f === null)).toBe(true);
  });

  it("止める合図で止まる。フォルダが無ければ何もしない", async () => {
    let calls = 0;
    const deps = fakeDeps([makePost({ id: "1" }), makePost({ id: "2" })], async () => '{"folder":"ゲーム","confidence":"high"}');
    expect(await runAiSorting({ ...deps, shouldStop: () => calls++ > 0 })).toMatchObject({ done: 0 });
    expect(await runAiSorting({ ...deps, folders: async () => [] })).toEqual({ done: 0, sorted: 0, stoppedByErrors: false });
  });
});
```

`src/db/ai-repo.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { makePost } from "../test/factories";
import { openTestDb } from "../test/db";
import { aiCandidates, aiFolders, countAiCandidates, recordAiResult } from "./ai-repo";

const db = openTestDb();
afterEach(async () => {
  await Promise.all([db.posts.clear(), db.folders.clear()]);
});

describe("aiCandidates", () => {
  it("未整理・手で整理していない・非表示でない・中身あり・この版で未判定のものを、新しいブクマ順に", async () => {
    await db.posts.bulkPut([
      makePost({ id: "1", bookmarkOrder: "10" }),
      makePost({ id: "2", bookmarkOrder: "30" }),
      makePost({ id: "3", bookmarkOrder: "20", aiCheckedFoldersVersion: 7 }),
      makePost({ id: "4", bookmarkOrder: "40", aiCheckedFoldersVersion: 6 }),
      makePost({ id: "5", sortedByUser: true }),
      makePost({ id: "6", hidden: true }),
      makePost({ id: "7", partial: true }),
      makePost({ id: "8", folders: [{ folderId: "a", by: "rule" }] }),
    ]);
    expect((await aiCandidates(db, 7)).map((p) => p.id)).toEqual(["4", "2", "1"]);
    expect((await aiCandidates(db, 7, 1)).map((p) => p.id)).toEqual(["4"]);
    expect(await countAiCandidates(db, 7)).toBe(3);
  });
});

describe("aiFolders", () => {
  it("フォルダの並び順で、手で入れた投稿の本文を例として 2 件まで添える", async () => {
    await db.folders.bulkPut([
      { id: "b", name: "B", description: "説明B", order: 1, createdAt: "" },
      { id: "a", name: "A", description: "", order: 0, createdAt: "" },
    ]);
    await db.posts.bulkPut([
      makePost({ id: "1", text: "例1", folders: [{ folderId: "a", by: "manual" }] }),
      makePost({ id: "2", text: "例2", folders: [{ folderId: "a", by: "manual" }] }),
      makePost({ id: "3", text: "例3", folders: [{ folderId: "a", by: "manual" }] }),
      makePost({ id: "4", text: "AI のもの", folders: [{ folderId: "b", by: "ai" }] }),
    ]);
    const result = await aiFolders(db);
    expect(result.map((f) => [f.id, f.description, f.examples.length])).toEqual([
      ["a", "", 2],
      ["b", "説明B", 0],
    ]);
  });
});

describe("recordAiResult", () => {
  it("まだ未整理なら AI として入れ、判定済みの版を記録する", async () => {
    await db.folders.put({ id: "a", name: "A", description: "", order: 0, createdAt: "" });
    await db.posts.put(makePost({ id: "1" }));
    expect(await recordAiResult(db, "1", "a", 3)).toBe(true);
    expect(await db.posts.get("1")).toMatchObject({ folders: [{ folderId: "a", by: "ai" }], aiCheckedFoldersVersion: 3 });
  });

  it("処理中に手で整理された投稿や、消えたフォルダには入れない（判定済みの版は記録する）", async () => {
    await db.folders.put({ id: "a", name: "A", description: "", order: 0, createdAt: "" });
    await db.posts.bulkPut([makePost({ id: "1", sortedByUser: true }), makePost({ id: "2" })]);
    expect(await recordAiResult(db, "1", "a", 3)).toBe(false);
    expect(await db.posts.get("1")).toMatchObject({ folders: [], aiCheckedFoldersVersion: 3 });
    expect(await recordAiResult(db, "2", "gone", 3)).toBe(false);
    expect(await db.posts.get("2")).toMatchObject({ folders: [], aiCheckedFoldersVersion: 3 });
  });

  it("該当なし（null）は判定済みの版だけ記録する。無い投稿は false", async () => {
    await db.posts.put(makePost({ id: "1" }));
    expect(await recordAiResult(db, "1", null, 3)).toBe(false);
    expect((await db.posts.get("1"))?.aiCheckedFoldersVersion).toBe(3);
    expect(await recordAiResult(db, "nothing", null, 3)).toBe(false);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/core/ai-runner.test.ts src/db/ai-repo.test.ts`
Expected: FAIL（モジュールが見つからない）

- [ ] **Step 3: 実装する**

`src/core/ai-runner.ts`:

```ts
import { AI_PROMPT_SOFT_LIMIT, buildClassifyPrompt, classifySchema, interpretClassify, type AiFolder } from "./ai-prompt";
import type { Post } from "./types";

export const AI_MAX_CONSECUTIVE_FAILURES = 5;

export type AiClassifier = (prompt: string, schema: object) => Promise<string>;
export type AiProgress = { done: number; sorted: number };
export type AiRunResult = AiProgress & { stoppedByErrors: boolean };

export type AiRunDeps = {
  folders(): Promise<AiFolder[]>;
  /** まだ判定していない投稿を少しずつ返す（記録したものは次から返さない） */
  candidates(): Promise<Post[]>;
  classify: AiClassifier;
  /** 結果を記録する。フォルダに入れたら true */
  record(postId: string, folderId: string | null): Promise<boolean>;
  shouldStop(): boolean;
  onProgress?(p: AiProgress): void;
};

async function classifyPost(post: Post, folders: AiFolder[], schema: object, classify: AiClassifier): Promise<string | null> {
  const withExamples = buildClassifyPrompt(post, folders, { withExamples: true });
  const short = buildClassifyPrompt(post, folders, { withExamples: false });
  if (withExamples.length > AI_PROMPT_SOFT_LIMIT) return interpretClassify(await classify(short, schema), folders);
  try {
    return interpretClassify(await classify(withExamples, schema), folders);
  } catch {
    return interpretClassify(await classify(short, schema), folders);
  }
}

/** 未整理の投稿を 1 件ずつ AI にかける。失敗した投稿は判定済みにして先へ進み、続けて失敗したら止める */
export async function runAiSorting(deps: AiRunDeps): Promise<AiRunResult> {
  const folders = await deps.folders();
  if (folders.length === 0) return { done: 0, sorted: 0, stoppedByErrors: false };
  const schema = classifySchema(folders.map((f) => f.name));
  let done = 0;
  let sorted = 0;
  let failures = 0;
  while (!deps.shouldStop()) {
    const batch = await deps.candidates();
    if (batch.length === 0) break;
    for (const post of batch) {
      if (deps.shouldStop()) break;
      try {
        const folderId = await classifyPost(post, folders, schema, deps.classify);
        if (await deps.record(post.id, folderId)) sorted++;
        done++;
        failures = 0;
      } catch {
        failures++;
        await deps.record(post.id, null).catch(() => false);
        if (failures >= AI_MAX_CONSECUTIVE_FAILURES) return { done, sorted, stoppedByErrors: true };
      }
      deps.onProgress?.({ done, sorted });
    }
  }
  return { done, sorted, stoppedByErrors: false };
}
```

`src/db/ai-repo.ts`:

```ts
import { AI_EXAMPLE_TEXT_LIMIT, AI_EXAMPLES_PER_FOLDER, truncate, type AiFolder } from "../core/ai-prompt";
import { compareByBookmark } from "../core/order";
import type { Post } from "../core/types";
import { listFolders } from "./folders";
import type { TwitTanaDB } from "./schema";

export const AI_BATCH_SIZE = 20;

function isAiCandidate(p: Post, foldersVersion: number): boolean {
  return !p.hidden && !p.sortedByUser && !p.partial && p.folders.length === 0 && p.aiCheckedFoldersVersion !== foldersVersion;
}

/** AI にかける投稿（新しいブクマ順） */
export async function aiCandidates(db: TwitTanaDB, foldersVersion: number, limit = AI_BATCH_SIZE): Promise<Post[]> {
  const posts = await db.posts.filter((p) => isAiCandidate(p, foldersVersion)).toArray();
  return posts.sort((a, b) => compareByBookmark(b, a)).slice(0, limit);
}

export async function countAiCandidates(db: TwitTanaDB, foldersVersion: number): Promise<number> {
  return db.posts.filter((p) => isAiCandidate(p, foldersVersion)).count();
}

/** AI に渡すフォルダ。手で入れた投稿の本文を例として添える */
export async function aiFolders(db: TwitTanaDB): Promise<AiFolder[]> {
  const [folders, manual] = await Promise.all([
    listFolders(db),
    db.posts.filter((p) => !p.hidden && p.folders.some((f) => f.by === "manual")).toArray(),
  ]);
  return folders.map((f) => ({
    id: f.id,
    name: f.name,
    description: f.description,
    examples: manual
      .filter((p) => p.folders.some((a) => a.folderId === f.id && a.by === "manual") && p.text)
      .slice(0, AI_EXAMPLES_PER_FOLDER)
      .map((p) => truncate(p.text, AI_EXAMPLE_TEXT_LIMIT)),
  }));
}

/**
 * AI の結果を記録する。どの場合も判定済みの版は記録する。
 * まだ未整理で手で整理されておらず、フォルダが実在するときだけ by: "ai" で入れ、true を返す。
 */
export async function recordAiResult(db: TwitTanaDB, postId: string, folderId: string | null, foldersVersion: number): Promise<boolean> {
  return db.transaction("rw", [db.posts, db.folders], async () => {
    const post = await db.posts.get(postId);
    if (!post) return false;
    const folderExists = folderId !== null && (await db.folders.get(folderId)) !== undefined;
    const canSort = folderExists && folderId !== null && !post.sortedByUser && !post.hidden && post.folders.length === 0;
    await db.posts.put({
      ...post,
      aiCheckedFoldersVersion: foldersVersion,
      folders: canSort ? [{ folderId, by: "ai" }] : post.folders,
    });
    return canSort;
  });
}
```

- [ ] **Step 4: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし

- [ ] **Step 5: Commit**

```bash
git add src/core/ai-runner.ts src/core/ai-runner.test.ts src/db/ai-repo.ts src/db/ai-repo.test.ts
git commit -m "AI: 未整理を順に分類する進め方と結果の記録" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: ブラウザの AI を包む

**Files:**
- Create: `src/ai/language-model.ts`, Test: `src/ai/language-model.test.ts`

**Interfaces:**
- Consumes: `AI_SYSTEM_PROMPT`（Task 1）、`AiClassifier`（Task 2）
- Produces: `type AiAvailability = "available" | "downloadable" | "downloading" | "unavailable"`、`normalizeAvailability(v: unknown): AiAvailability`、`aiAvailability(): Promise<AiAvailability>`、`type AiSession`、`createAiSession(onProgress?: (ratio: number) => void): Promise<AiSession>`、`classifierFrom(base: AiSession): AiClassifier`

- [ ] **Step 1: 失敗するテストを書く**

`src/ai/language-model.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { aiAvailability, classifierFrom, createAiSession, normalizeAvailability, type AiSession } from "./language-model";

const g = globalThis as { LanguageModel?: unknown };
afterEach(() => {
  delete g.LanguageModel;
});

describe("normalizeAvailability", () => {
  it("新旧どちらの呼び名も 4 種類にそろえる", () => {
    expect(normalizeAvailability("available")).toBe("available");
    expect(normalizeAvailability("readily")).toBe("available");
    expect(normalizeAvailability("downloadable")).toBe("downloadable");
    expect(normalizeAvailability("after-download")).toBe("downloadable");
    expect(normalizeAvailability("downloading")).toBe("downloading");
    expect(normalizeAvailability("no")).toBe("unavailable");
    expect(normalizeAvailability(undefined)).toBe("unavailable");
  });
});

describe("aiAvailability", () => {
  it("LanguageModel が無ければ使えない", async () => {
    expect(await aiAvailability()).toBe("unavailable");
  });
  it("ある場合は日本語と英語を指定して聞く。例外なら使えない", async () => {
    const availability = vi.fn(async () => "available");
    g.LanguageModel = { availability, create: vi.fn() };
    expect(await aiAvailability()).toBe("available");
    expect(availability).toHaveBeenCalledWith(expect.objectContaining({ expectedInputs: [{ type: "text", languages: ["en", "ja"] }] }));
    g.LanguageModel = { availability: async () => Promise.reject(new Error("x")), create: vi.fn() };
    expect(await aiAvailability()).toBe("unavailable");
  });
});

describe("createAiSession", () => {
  it("システムの指示文つきで作り、ダウンロードの進み具合を知らせる", async () => {
    const create = vi.fn(async (opts: { monitor?: (m: EventTarget) => void }) => {
      const target = new EventTarget();
      opts.monitor?.(target);
      const e = new Event("downloadprogress");
      Object.assign(e, { loaded: 0.5 });
      target.dispatchEvent(e);
      return { prompt: vi.fn(), clone: vi.fn(), destroy: vi.fn() };
    });
    g.LanguageModel = { availability: vi.fn(), create };
    const progress = vi.fn();
    await createAiSession(progress);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ initialPrompts: [expect.objectContaining({ role: "system" })] }));
    expect(progress).toHaveBeenCalledWith(0.5);
  });
  it("LanguageModel が無ければ例外", async () => {
    await expect(createAiSession()).rejects.toThrow();
  });
});

describe("classifierFrom", () => {
  it("1 件ごとに複製したセッションで聞き、終わったら捨てる", async () => {
    const clone: AiSession = { prompt: vi.fn(async () => '{"ok":1}'), clone: vi.fn(), destroy: vi.fn() };
    const base: AiSession = { prompt: vi.fn(), clone: vi.fn(async () => clone), destroy: vi.fn() };
    const classify = classifierFrom(base);
    expect(await classify("p", { type: "object" })).toBe('{"ok":1}');
    expect(clone.prompt).toHaveBeenCalledWith("p", { responseConstraint: { type: "object" } });
    expect(clone.destroy).toHaveBeenCalled();
    expect(base.prompt).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/ai/language-model.test.ts`
Expected: FAIL（`./language-model` が見つからない）

- [ ] **Step 3: 実装する**

`src/ai/language-model.ts`:

```ts
import { AI_SYSTEM_PROMPT } from "../core/ai-prompt";
import type { AiClassifier } from "../core/ai-runner";

export type AiAvailability = "available" | "downloadable" | "downloading" | "unavailable";

export type AiSession = {
  prompt(input: string, options?: { responseConstraint?: object }): Promise<string>;
  clone(): Promise<AiSession>;
  destroy(): void;
};

type LanguageModelStatic = {
  availability(options?: object): Promise<unknown>;
  create(options?: object): Promise<AiSession>;
};

const LANGUAGES = {
  expectedInputs: [{ type: "text", languages: ["en", "ja"] }],
  expectedOutputs: [{ type: "text", languages: ["en", "ja"] }],
};

/** Chrome 内蔵 AI（Prompt API）。Edge や古い Chrome には無い */
function api(): LanguageModelStatic | null {
  return (globalThis as { LanguageModel?: LanguageModelStatic }).LanguageModel ?? null;
}

/** 版によって違う呼び名を 4 種類にそろえる */
export function normalizeAvailability(v: unknown): AiAvailability {
  if (v === "available" || v === "readily") return "available";
  if (v === "downloadable" || v === "after-download") return "downloadable";
  if (v === "downloading") return "downloading";
  return "unavailable";
}

export async function aiAvailability(): Promise<AiAvailability> {
  const lm = api();
  if (!lm) return "unavailable";
  try {
    return normalizeAvailability(await lm.availability(LANGUAGES));
  } catch {
    return "unavailable";
  }
}

/** AI のセッションを作る。モデルが未取得ならダウンロードが始まる（利用者のクリックの中で呼ぶこと） */
export async function createAiSession(onProgress?: (ratio: number) => void): Promise<AiSession> {
  const lm = api();
  if (!lm) throw new Error("LanguageModel is not available in this browser");
  return lm.create({
    ...LANGUAGES,
    initialPrompts: [{ role: "system", content: AI_SYSTEM_PROMPT }],
    monitor(m: EventTarget) {
      m.addEventListener("downloadprogress", (e) => {
        const loaded = (e as Event & { loaded?: unknown }).loaded;
        if (typeof loaded === "number") onProgress?.(loaded);
      });
    },
  });
}

/** 1 件ごとに元のセッションを複製して聞く（前の投稿の内容を引きずらないため） */
export function classifierFrom(base: AiSession): AiClassifier {
  return async (prompt, schema) => {
    const session = await base.clone();
    try {
      return await session.prompt(prompt, { responseConstraint: schema });
    } finally {
      session.destroy();
    }
  };
}
```

- [ ] **Step 4: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし

- [ ] **Step 5: Commit**

```bash
git add src/ai
git commit -m "AI: ブラウザ内蔵 AI を包む（使えるか・準備・分類）" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 英語の辞書と言語の切り替え

**Files:**
- Create: `src/i18n/en.ts`
- Modify: `src/i18n/ja.ts`（キーを足す）、`src/i18n/index.ts`（全体を置き換え）
- Test: `src/i18n/index.test.ts`（足す）

**Interfaces:**
- Produces: `en: Record<MessageKey, string>`、`type Language = "ja" | "en"`、`type LanguageSetting = "auto" | Language`、`resolveLanguage(setting: LanguageSetting, browserLanguage: string): Language`、`setLanguage(setting: LanguageSetting): Language`、`getLanguage(): Language`、`t()`（今の言語の辞書を引く。初期は日本語）

- [ ] **Step 1: 日本語の辞書にキーを足す**

`src/i18n/ja.ts` の `} as const;` の直前に次を足す（AI・言語・x.com 上の画面の文言）:

```ts
  "ai.title": "AI 分類（Chrome 内蔵 AI）",
  "ai.help": "本棚画面を開いている間に、未整理の投稿を 1 件ずつ AI がフォルダに振り分けます。フォルダの説明と、手で入れた投稿をヒントにします。自信がないものは未整理のまま残します。AI はこの PC の中だけで動き、外部には送りません。",
  "ai.status.available": "この PC で使えます",
  "ai.status.downloadable": "最初に AI のモデル（数 GB）をダウンロードします",
  "ai.status.downloading": "モデルをダウンロード中です",
  "ai.status.unavailable": "この PC・ブラウザでは AI 分類は使えません。ルールでの振り分けは使えます。",
  "ai.prepare": "AI を準備する",
  "ai.progress": "ダウンロード中 {percent}%",
  "ai.enable": "未整理の投稿を AI で自動的に振り分ける",
  "ai.run": "未整理を AI で振り分け",
  "ai.waiting": "AI で振り分けられる未整理：{count} 件",
  "ai.running": "AI が振り分け中…（{done} 件見て {sorted} 件を振り分け）",
  "ai.finished": "AI が {done} 件見て、{sorted} 件を振り分けました",
  "ai.stopped": "AI の処理でエラーが続いたので止めました",
  "ai.needFolders": "AI に振り分けてもらうには、先にフォルダを作ってください",
  "settings.language": "表示言語",
  "settings.language.auto": "ブラウザに合わせる",
  "settings.language.ja": "日本語",
  "settings.language.en": "English",
  "picker.dialog": "ツイッ棚のフォルダ",
  "picker.title": "ツイッ棚に整理",
  "picker.close": "閉じる",
  "picker.empty": "フォルダがまだありません",
  "picker.newPlaceholder": "新しいフォルダ",
  "picker.newLabel": "新しいフォルダの名前",
  "picker.add": "追加",
  "counter.text": "ツイッ棚：このページで {count} 件取り込み",
  "counter.total": "（全 {total} 件）",
  "counter.warning": "X の仕様が変わったようです。更新をお待ちください",
```

- [ ] **Step 2: 失敗するテストを足す**

`src/i18n/index.test.ts` の末尾に足す（import 行は `import { en } from "./en";` と `import { getLanguage, ja, resolveLanguage, setLanguage, t } from "./index";` に置き換え、`afterEach` を vitest から import する）:

```ts
describe("言語の切り替え", () => {
  afterEach(() => {
    setLanguage("ja");
  });

  it("auto はブラウザの言語が日本語なら日本語、それ以外は英語", () => {
    expect(resolveLanguage("auto", "ja-JP")).toBe("ja");
    expect(resolveLanguage("auto", "en-US")).toBe("en");
    expect(resolveLanguage("auto", "fr")).toBe("en");
    expect(resolveLanguage("ja", "en-US")).toBe("ja");
    expect(resolveLanguage("en", "ja")).toBe("en");
  });

  it("英語にすると英語の辞書を引く", () => {
    setLanguage("en");
    expect(getLanguage()).toBe("en");
    expect(t("app.title")).toBe("TwitTana");
    expect(t("review.left", { count: 2 })).toBe("2 left");
  });

  it("英語の辞書の文言は空でなく、{名前} の差し込み口が日本語と同じ", () => {
    for (const key of Object.keys(ja) as (keyof typeof ja)[]) {
      expect(en[key], key).not.toBe("");
      const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(holes(en[key]), key).toEqual(holes(ja[key]));
    }
  });
});
```

- [ ] **Step 3: 失敗を確かめる**

Run: `npx vitest run src/i18n/index.test.ts`
Expected: FAIL（`./en` が見つからない）

- [ ] **Step 4: 実装する**

`src/i18n/en.ts`:

```ts
import type { ja } from "./ja";

/** 英語の文言。日本語の辞書と同じキーをすべて持つ（足りないと型エラー） */
export const en: Record<keyof typeof ja, string> = {
  "app.title": "TwitTana",
  "app.unofficial": "Unofficial tool, not affiliated with X Corp. Your data stays in this browser and is never sent anywhere.",
  "tab.shelf": "Shelf",
  "tab.organize": "Folders & rules",
  "tab.settings": "Settings",
  "error.generic": "Could not save ({message}). To be safe, back up your data with “Export” in Settings.",
  "error.close": "Close",
  "view.all": "All",
  "view.unsorted": "Unsorted",
  "view.ai": "Sorted by AI",
  "view.removed": "Removed on X",
  "view.hidden": "Hidden",
  "view.folders": "Folders",
  "view.nav": "Filters",
  "shelf.search": "Search text, names, @handles",
  "shelf.sort": "Sort",
  "shelf.sort.bookmark-desc": "Newest bookmarks",
  "shelf.sort.bookmark-asc": "Oldest bookmarks",
  "shelf.sort.posted-desc": "Newest posts",
  "shelf.sort.posted-asc": "Oldest posts",
  "shelf.count": "{count} posts",
  "shelf.list": "Posts",
  "shelf.empty": "Nothing here yet. Open your bookmarks on X and scroll to import them.",
  "shelf.more": "Show more ({count} left)",
  "bulk.selected": "{count} selected",
  "bulk.chooseFolder": "Choose a folder",
  "bulk.add": "Add",
  "bulk.remove": "Remove",
  "bulk.hide": "Hide",
  "bulk.unhide": "Unhide",
  "bulk.clear": "Clear selection",
  "post.select": "Select this post",
  "post.open": "Open on X",
  "post.removed": "Removed on X",
  "post.partial": "Details will be filled in when you open your bookmarks on X",
  "post.by.ai": "AI",
  "post.by.rule": "Rule",
  "post.quoted": "Quoting @{handle}",
  "review.title": "Today’s look-back",
  "review.left": "{count} left",
  "review.seen": "Seen",
  "review.toFolder": "Add to folder",
  "review.hide": "Don’t show again",
  "review.done": "All done for today! See you tomorrow.",
  "folders.title": "Folders",
  "folders.new": "New folder name",
  "folders.add": "Add",
  "folders.name": "Folder name",
  "folders.description": "Description (a hint for AI, e.g. “stream announcements”)",
  "folders.up": "Move up",
  "folders.down": "Move down",
  "folders.delete": "Delete",
  "folders.confirmDelete": "Delete the folder “{name}”? Posts are kept and simply removed from this folder. Rules for this folder will be deleted.",
  "folders.error.empty": "Please enter a name",
  "folders.error.duplicate": "A folder with the same name already exists",
  "folders.none": "No folders yet",
  "rules.title": "Auto-sorting rules",
  "rules.help": "Posts that match all conditions go into the chosen folder. Posts you sorted by hand are never touched.",
  "rules.folder": "Folder",
  "rules.kind": "Condition type",
  "rules.addCondition": "Add condition",
  "rules.removeCondition": "Remove this condition",
  "rules.save": "Add rule",
  "rules.enabled": "On",
  "rules.delete": "Delete",
  "rules.applyNow": "Apply to unsorted now",
  "rules.applied": "Sorted {count} posts",
  "rules.none": "No rules yet",
  "rules.needFolder": "Create a folder first",
  "rules.invalid": "Please fill in the condition",
  "cond.keyword": "Text contains",
  "cond.author": "Author (@handle)",
  "cond.hashtag": "Hashtag",
  "cond.domain": "Links to site",
  "cond.hasMedia": "Has media",
  "cond.media.any": "Any",
  "cond.media.photo": "Image",
  "cond.media.video": "Video or GIF",
  "settings.stats": "Imported posts: {count}",
  "settings.picker": "Show the folder menu right after bookmarking",
  "settings.reviewPerDay": "Posts to look back on per day (from tomorrow)",
  "settings.backup": "Backup",
  "settings.export": "Export (JSON)",
  "settings.import": "Import",
  "settings.imported": "Imported: {posts} posts, {folders} new folders, {rules} new rules",
  "settings.importError.not-json": "This is not a JSON file",
  "settings.importError.wrong-app": "This is not a TwitTana export file",
  "settings.importError.unsupported-version": "This file format is not supported by this version",
  "settings.importError.invalid-shape": "The file seems to be broken",
  "settings.health.warning": "X seems to have changed, and recent imports did not work ({op}). Please wait for an update.",
  "settings.about": "About",
  "settings.privacy": "Privacy policy",
  "settings.donate": "Support development",
  "ai.title": "AI sorting (Chrome built-in AI)",
  "ai.help": "While this page is open, AI sorts unsorted posts into folders one by one, using folder descriptions and posts you sorted by hand as hints. Posts it is unsure about stay unsorted. The AI runs only on this PC and sends nothing outside.",
  "ai.status.available": "Available on this PC",
  "ai.status.downloadable": "The AI model (a few GB) will be downloaded first",
  "ai.status.downloading": "Downloading the model",
  "ai.status.unavailable": "AI sorting is not available on this PC or browser. Rules still work.",
  "ai.prepare": "Set up AI",
  "ai.progress": "Downloading {percent}%",
  "ai.enable": "Sort unsorted posts with AI automatically",
  "ai.run": "Sort unsorted with AI",
  "ai.waiting": "Unsorted posts AI can sort: {count}",
  "ai.running": "AI is sorting… (checked {done}, sorted {sorted})",
  "ai.finished": "AI checked {done} posts and sorted {sorted}",
  "ai.stopped": "AI stopped after repeated errors",
  "ai.needFolders": "Create folders first so AI can sort into them",
  "settings.language": "Language",
  "settings.language.auto": "Same as browser",
  "settings.language.ja": "日本語",
  "settings.language.en": "English",
  "picker.dialog": "TwitTana folders",
  "picker.title": "Save to TwitTana",
  "picker.close": "Close",
  "picker.empty": "No folders yet",
  "picker.newPlaceholder": "New folder",
  "picker.newLabel": "New folder name",
  "picker.add": "Add",
  "counter.text": "TwitTana: {count} imported on this page",
  "counter.total": " ({total} total)",
  "counter.warning": "X seems to have changed. Please wait for an update.",
};
```

`src/i18n/index.ts`（全体を置き換え）:

```ts
import { en } from "./en";
import { ja } from "./ja";

export { ja };
export type MessageKey = keyof typeof ja;
export type Language = "ja" | "en";
export type LanguageSetting = "auto" | Language;

const DICTIONARIES: Record<Language, Record<MessageKey, string>> = { ja, en };
let current: Language = "ja";

/** auto はブラウザの言語が日本語なら日本語、それ以外は英語 */
export function resolveLanguage(setting: LanguageSetting, browserLanguage: string): Language {
  if (setting !== "auto") return setting;
  return browserLanguage.toLowerCase().startsWith("ja") ? "ja" : "en";
}

/** 表示言語を決める（本棚画面と x.com 上の画面が、設定を読んだら呼ぶ） */
export function setLanguage(setting: LanguageSetting): Language {
  current = resolveLanguage(setting, typeof navigator === "undefined" ? "ja" : navigator.language);
  return current;
}

export function getLanguage(): Language {
  return current;
}

/** 今の言語の文言を引く。{名前} を params の値で置き換える */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  let text = DICTIONARIES[current][key];
  for (const [name, value] of Object.entries(params)) text = text.split(`{${name}}`).join(String(value));
  return text;
}
```

- [ ] **Step 5: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし（英語の辞書のキーの過不足は型エラーになる） / `npm run lint` → エラーなし

- [ ] **Step 6: Commit**

```bash
git add src/i18n
git commit -m "言語: 英語の辞書と言語の切り替え" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 画面を設定の言語に従わせる

**Files:**
- Modify: `src/ui/picker/FolderPicker.tsx`、`src/bridge/BridgeApp.tsx`、`src/background/protocol.ts`、`src/background/handlers.ts`、`src/background/handlers.test.ts`、`src/entrypoints/x-bridge.content.tsx`、`src/dashboard/SettingsPanel.tsx`、`src/entrypoints/dashboard/App.tsx`、`wxt.config.ts`
- Create: `public/_locales/ja/messages.json`、`public/_locales/en/messages.json`
- Test: `src/ui/picker/FolderPicker.test.tsx`（足す）

**Interfaces:**
- Consumes: `t`, `setLanguage`, `LanguageSetting`（Task 4）
- Produces: `PickerState` に `language: LanguageSetting` を足す。`BgResponseMap["get-stats"]` に `language: LanguageSetting` を足す

- [ ] **Step 1: 失敗するテストを足す**

`src/ui/picker/FolderPicker.test.tsx` の末尾に足す（`setLanguage` を `../../i18n` から import）:

```tsx
describe("FolderPicker の言語", () => {
  afterEach(() => {
    setLanguage("ja");
  });
  it("英語にすると英語で出る", () => {
    setLanguage("en");
    setup({ folders: [] });
    expect(screen.getByText("No folders yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    expect(screen.getByLabelText("New folder name")).toBeTruthy();
  });
});
```

`src/background/handlers.test.ts` の `get-picker-state` と `get-stats` の期待値に `language: "auto"` を足す:

```ts
    expect(await handleRequest(db, { type: "get-picker-state", postId: "1" }, NOW)).toEqual({ enabled: false, folders: [f], selected: [f.id], language: "auto" });
```

```ts
    expect(await handleRequest(db, { type: "get-stats" }, NOW)).toEqual({ total: 2, health: {}, language: "auto" });
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/ui/picker/FolderPicker.test.tsx src/background/handlers.test.ts`
Expected: FAIL（英語にならない・`language` が無い）

- [ ] **Step 3: x.com 上の画面と裏方を直す**

`src/ui/picker/FolderPicker.tsx`:
- `import { t } from "../../i18n";` を足す
- `ERROR_TEXT` を消し、エラー表示を `{t(error === "empty" ? "folders.error.empty" : "folders.error.duplicate")}` にする
- 直書きの文言を辞書に置き換える: `aria-label="ツイッ棚のフォルダ"` → `aria-label={t("picker.dialog")}`、`ツイッ棚に整理` → `{t("picker.title")}`、`aria-label="閉じる"` → `aria-label={t("picker.close")}`、`フォルダがまだありません` → `{t("picker.empty")}`、`placeholder="新しいフォルダ"` → `placeholder={t("picker.newPlaceholder")}`、`aria-label="新しいフォルダの名前"` → `aria-label={t("picker.newLabel")}`、ボタンの `追加` → `{t("picker.add")}`

`src/bridge/BridgeApp.tsx` の件数表示を次に置き換える（`import { t } from "../i18n";` を足す）:

```tsx
        <div className="tt-counter" role="status">
          {t("counter.text", { count: state.counter.sessionCount })}
          {state.counter.total !== null && t("counter.total", { total: state.counter.total })}
          {state.counter.warning && <span className="tt-counter__warn">{t("counter.warning")}</span>}
        </div>
```

`src/background/protocol.ts`:
- `import type { LanguageSetting } from "../i18n";` を足す
- `export type PickerState = { enabled: boolean; folders: Folder[]; selected: string[]; language: LanguageSetting };`
- `"get-stats": { total: number; health: ParseHealth; language: LanguageSetting };`

`src/background/handlers.ts`:
- `get-picker-state` の返り値を `{ enabled: settings.pickerOnBookmark, folders, selected, language: settings.language }` にする
- `get-stats` を次にする:

```ts
    case "get-stats": {
      const settings = await getSettings(db);
      return { total: await db.posts.count(), health: settings.parseHealth, language: settings.language };
    }
```

`src/entrypoints/x-bridge.content.tsx`:
- `import { setLanguage } from "../i18n";` を足す
- `refreshCounter` の中で `stats` を受け取った直後に `setLanguage(stats.language);` を足す
- `bookmark-added` の処理で `picker` を受け取った直後に `setLanguage(picker.language);` を足す

- [ ] **Step 4: 本棚画面を直す**

`src/dashboard/SettingsPanel.tsx` の「1 日に見返す件数」の `<label>` の直後に足す（`import type { LanguageSetting } from "../i18n";` を足す）:

```tsx
      <label className="flex items-center gap-2">
        {t("settings.language")}
        <select
          value={settings.language}
          onChange={(e) => void run(() => updateSettings(db, { language: e.target.value as LanguageSetting }))}
          className="rounded-lg border border-amber-300 bg-white px-2 py-1 dark:border-stone-600 dark:bg-stone-900"
        >
          <option value="auto">{t("settings.language.auto")}</option>
          <option value="ja">{t("settings.language.ja")}</option>
          <option value="en">{t("settings.language.en")}</option>
        </select>
      </label>
```

`src/entrypoints/dashboard/App.tsx`:
- `import { useSettings } from "../../dashboard/data";` と、`../../i18n` から `setLanguage` を足す
- `App` の先頭で設定を読み、描画の前に言語を決める:

```tsx
  const settings = useSettings();
  if (settings) {
    const language = setLanguage(settings.language);
    document.documentElement.lang = language;
  }
```

（`useSettings` は他のフックと同じく、`useState` より前でも後でもよいが、条件分岐の中に置かない）

- [ ] **Step 5: 拡張の名前・説明を多言語化する**

`public/_locales/ja/messages.json`:

```json
{
  "extName": { "message": "ツイッ棚" },
  "extDescription": { "message": "Twitter（現 X）のブックマークを自分のフォルダに整理して見返す（非公式）" },
  "actionTitle": { "message": "ツイッ棚を開く" }
}
```

`public/_locales/en/messages.json`:

```json
{
  "extName": { "message": "TwitTana" },
  "extDescription": { "message": "Organize your X (formerly Twitter) bookmarks into your own folders and look back at them. Unofficial." },
  "actionTitle": { "message": "Open TwitTana" }
}
```

`wxt.config.ts` の `manifest` を次にする:

```ts
  manifest: {
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",
    default_locale: "ja",
    permissions: ["unlimitedStorage"],
    action: { default_title: "__MSG_actionTitle__" },
  },
```

- [ ] **Step 6: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし
Run: `npm run build` → 成功。`.output/chrome-mv3/_locales/ja/messages.json` と `en/messages.json` がある。無ければ、WXT の public ディレクトリが `src/public/` になっているので、`public/` を `src/public/` へ移してビルドし直す（このあとの Task 6 のアイコンも同じ場所に置く）

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "言語: 本棚画面と x.com 上の画面を設定の言語に従わせ、拡張名も多言語化" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 本棚画面で AI を動かす

**Files:**
- Create: `src/dashboard/useAiSorter.ts`、`src/dashboard/AiStatus.tsx`、`src/dashboard/AiSettings.tsx`
- Modify: `src/dashboard/Shelf.tsx`（`ReviewStrip` の直後に `<AiStatus />`）、`src/dashboard/SettingsPanel.tsx`（バックアップの節の前に `<AiSettings />`）
- Test: `src/dashboard/AiSettings.test.tsx`

**Interfaces:**
- Consumes: Task 2・3、`useSettings`・`useFolders`（計画3）、`updateSettings`（計画1）、`useRun`・`useDb`（計画3）
- Produces: `useAiAvailability(): AiAvailability | undefined`、`type AiSorterState = { status: "idle" | "running" | "finished" | "stopped"; done: number; sorted: number }`、`useAiSorter(): { state: AiSorterState; waiting: number | undefined; start(): void }`、`AiStatus()`、`AiSettings()`

- [ ] **Step 1: 失敗するテストを書く**

`src/dashboard/AiSettings.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSettings } from "../db/settings";
import { openTestDb } from "../test/db";
import { AiSettings } from "./AiSettings";
import { DbProvider } from "./db-context";

const g = globalThis as { LanguageModel?: unknown };
const db = openTestDb();
afterEach(async () => {
  cleanup();
  delete g.LanguageModel;
  await db.kv.clear();
});

function renderAi() {
  render(
    <DbProvider value={db}>
      <AiSettings />
    </DbProvider>,
  );
}

describe("AiSettings", () => {
  it("AI の無いブラウザでは使えない旨だけを出す", async () => {
    renderAi();
    expect(await screen.findByText("この PC・ブラウザでは AI 分類は使えません。ルールでの振り分けは使えます。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "AI を準備する" })).toBeNull();
  });

  it("未取得なら準備ボタンで準備し、使える状態にしてオンにする", async () => {
    let state = "downloadable";
    g.LanguageModel = {
      availability: vi.fn(async () => state),
      create: vi.fn(async () => {
        state = "available";
        return { prompt: vi.fn(), clone: vi.fn(), destroy: vi.fn() };
      }),
    };
    renderAi();
    fireEvent.click(await screen.findByRole("button", { name: "AI を準備する" }));
    await waitFor(async () => expect((await getSettings(db)).aiEnabled).toBe(true));
    expect(await screen.findByText("この PC で使えます")).toBeTruthy();
    const box = screen.getByLabelText("未整理の投稿を AI で自動的に振り分ける") as HTMLInputElement;
    expect(box.checked).toBe(true);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/dashboard/AiSettings.test.tsx`
Expected: FAIL（`./AiSettings` が見つからない）

- [ ] **Step 3: 実装する**

`src/dashboard/useAiSorter.ts`:

```ts
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useRef, useState } from "react";
import { aiAvailability, classifierFrom, createAiSession, type AiAvailability } from "../ai/language-model";
import { runAiSorting } from "../core/ai-runner";
import { aiCandidates, aiFolders, countAiCandidates, recordAiResult } from "../db/ai-repo";
import { useSettings } from "./data";
import { useDb } from "./db-context";

/** この PC で AI が使えるか（調べている間は undefined）。refresh で調べ直す */
export function useAiAvailability(): [AiAvailability | undefined, () => void] {
  const [availability, setAvailability] = useState<AiAvailability>();
  const refresh = useCallback(() => {
    void aiAvailability().then(setAvailability);
  }, []);
  useEffect(refresh, [refresh]);
  return [availability, refresh];
}

export type AiSorterState = { status: "idle" | "running" | "finished" | "stopped"; done: number; sorted: number };

/** 本棚画面を開いている間、未整理を AI で振り分ける。設定でオンかつ使えるときは自動で始める */
export function useAiSorter(): { state: AiSorterState; waiting: number | undefined; start(): void; usable: boolean } {
  const db = useDb();
  const settings = useSettings();
  const [availability] = useAiAvailability();
  const [state, setState] = useState<AiSorterState>({ status: "idle", done: 0, sorted: 0 });
  const running = useRef(false);
  const stopped = useRef(false);
  const version = settings?.foldersVersion;
  const waiting = useLiveQuery(() => (version === undefined ? undefined : countAiCandidates(db, version)), [db, version]);
  const usable = availability === "available" && settings?.aiEnabled === true;

  useEffect(() => {
    stopped.current = false;
    return () => {
      stopped.current = true;
    };
  }, []);

  const start = useCallback(() => {
    if (running.current || version === undefined) return;
    running.current = true;
    setState({ status: "running", done: 0, sorted: 0 });
    void (async () => {
      try {
        const classify = classifierFrom(await createAiSession());
        const result = await runAiSorting({
          folders: () => aiFolders(db),
          candidates: () => aiCandidates(db, version),
          classify,
          record: (postId, folderId) => recordAiResult(db, postId, folderId, version),
          shouldStop: () => stopped.current,
          onProgress: (p) => setState({ status: "running", ...p }),
        });
        setState({ status: result.stoppedByErrors ? "stopped" : "finished", done: result.done, sorted: result.sorted });
      } catch {
        setState((s) => ({ ...s, status: "stopped" }));
      } finally {
        running.current = false;
      }
    })();
  }, [db, version]);

  useEffect(() => {
    if (usable && waiting !== undefined && waiting > 0 && state.status === "idle") start();
  }, [usable, waiting, state.status, start]);

  return { state, waiting, start, usable };
}
```

`src/dashboard/AiStatus.tsx`:

```tsx
import { t } from "../i18n";
import { useFolders } from "./data";
import { useAiSorter } from "./useAiSorter";

/** 本棚タブの AI の状態とボタン（AI が使えてオンのときだけ出す） */
export function AiStatus() {
  const folders = useFolders();
  const { state, waiting, start, usable } = useAiSorter();
  if (!usable || !folders) return null;
  if (folders.length === 0) return <p className="text-sm text-stone-500">{t("ai.needFolders")}</p>;
  const text =
    state.status === "running"
      ? t("ai.running", { done: state.done, sorted: state.sorted })
      : state.status === "stopped"
        ? t("ai.stopped")
        : state.status === "finished"
          ? t("ai.finished", { done: state.done, sorted: state.sorted })
          : t("ai.waiting", { count: waiting ?? 0 });
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-2 text-sm dark:bg-stone-800">
      <span>{text}</span>
      {state.status !== "running" && (waiting ?? 0) > 0 && (
        <button type="button" className="rounded-lg bg-amber-700 px-3 py-1 text-white dark:bg-amber-600" onClick={start}>
          {t("ai.run")}
        </button>
      )}
    </div>
  );
}
```

`src/dashboard/AiSettings.tsx`:

```tsx
import { useState } from "react";
import { createAiSession } from "../ai/language-model";
import { updateSettings } from "../db/settings";
import { t } from "../i18n";
import { useSettings } from "./data";
import { useDb } from "./db-context";
import { useRun } from "./errors";
import { useAiAvailability } from "./useAiSorter";

const STATUS_KEY = {
  available: "ai.status.available",
  downloadable: "ai.status.downloadable",
  downloading: "ai.status.downloading",
  unavailable: "ai.status.unavailable",
} as const;

/** 設定タブの AI の項目 */
export function AiSettings() {
  const db = useDb();
  const run = useRun();
  const settings = useSettings();
  const [availability, refresh] = useAiAvailability();
  const [progress, setProgress] = useState<number | null>(null);

  if (!settings || !availability) return null;

  const prepare = () =>
    void run(async () => {
      setProgress(0);
      const session = await createAiSession((ratio) => setProgress(ratio));
      session.destroy();
      setProgress(null);
      await updateSettings(db, { aiEnabled: true });
      refresh();
    });

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold">{t("ai.title")}</h2>
      <p className="text-sm">{t(STATUS_KEY[availability])}</p>
      {availability !== "unavailable" && (
        <>
          <p className="text-sm text-stone-600 dark:text-stone-400">{t("ai.help")}</p>
          {availability === "available" ? (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-amber-700"
                checked={settings.aiEnabled}
                onChange={(e) => void run(() => updateSettings(db, { aiEnabled: e.target.checked }))}
              />
              {t("ai.enable")}
            </label>
          ) : (
            <button type="button" className="rounded-lg bg-amber-700 px-3 py-1.5 text-white disabled:opacity-50 dark:bg-amber-600" disabled={progress !== null} onClick={prepare}>
              {progress === null ? t("ai.prepare") : t("ai.progress", { percent: Math.round(progress * 100) })}
            </button>
          )}
        </>
      )}
    </section>
  );
}
```

`src/dashboard/Shelf.tsx`: `import { AiStatus } from "./AiStatus";` を足し、`<ReviewStrip posts={postMap} folders={folders} />` の直後に `<AiStatus />` を足す。

`src/dashboard/SettingsPanel.tsx`: `import { AiSettings } from "./AiSettings";` を足し、`<section className="space-y-2">`（バックアップの節）の直前に `<AiSettings />` を足す。

- [ ] **Step 4: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし / `npm run build` → 成功

- [ ] **Step 5: Commit**

```bash
git add src/dashboard
git commit -m "AI: 本棚画面で未整理を AI で振り分ける（設定と状態表示）" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: アイコン

**Files:**
- Create: `src/assets/icon.svg`、`scripts/make-icons.mjs`、`public/icon/16.png`・`32.png`・`48.png`・`128.png`
- Modify: `package.json`（`icons` スクリプト）

（Task 5 で public の場所を `src/public/` に移した場合は、ここの `public/` もすべて `src/public/` に読み替える）

- [ ] **Step 1: 開発用の依存を入れ、アイコンの元絵を書く**

Run: `npm install -D sharp`

`src/assets/icon.svg`（本棚に本が並び、しおりが 1 本垂れている絵。X のロゴや鳥は使わない）:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#7c5a3a"/>
  <rect x="18" y="98" width="92" height="9" rx="3" fill="#f3e3c7"/>
  <rect x="26" y="42" width="17" height="56" rx="3" fill="#f7efe1"/>
  <rect x="47" y="30" width="18" height="68" rx="3" fill="#e9c27a"/>
  <rect x="69" y="48" width="15" height="50" rx="3" fill="#f7efe1"/>
  <rect x="88" y="38" width="16" height="60" rx="3" fill="#d98c5f" transform="rotate(9 96 68)"/>
  <path d="M52 30h8v24l-4-4-4 4z" fill="#b5452b"/>
</svg>
```

`scripts/make-icons.mjs`:

```js
// アイコンの元絵（SVG）から、拡張に必要な大きさの PNG を作る。npm run icons
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const SIZES = [16, 32, 48, 128];
await mkdir("public/icon", { recursive: true });
for (const size of SIZES) {
  await sharp("src/assets/icon.svg", { density: 384 }).resize(size, size).png().toFile(`public/icon/${size}.png`);
}
console.log(`public/icon/ に ${SIZES.join(", ")} px のアイコンを作りました`);
```

`package.json` の `scripts` に `"icons": "node scripts/make-icons.mjs"` を足す。

- [ ] **Step 2: 作って確かめる**

Run: `npm run icons` → `public/icon/` に 4 つの PNG ができる
Run: `npm run build` → `.output/chrome-mv3/manifest.json` の `icons` に 16・32・48・128 が入っている

- [ ] **Step 3: Commit**

```bash
git add src/assets/icon.svg scripts/make-icons.mjs public/icon package.json package-lock.json
git commit -m "公開準備: 本棚のアイコン" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: プライバシーポリシーと掲載文

**Files:**
- Create: `docs/.nojekyll`（空）、`docs/index.html`、`docs/privacy.html`、`docs/store/listing.md`
- Modify: `src/config.ts`

- [ ] **Step 1: GitHub Pages で出すページを書く**

`docs/privacy.html`:

```html
<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ツイッ棚 プライバシーポリシー / TwitTana Privacy Policy</title>
  <style>
    body { max-width: 720px; margin: 0 auto; padding: 24px 16px; font-family: system-ui, sans-serif; line-height: 1.7; color: #2b2118; background: #fffaf3; }
    h1, h2 { line-height: 1.3; }
    @media (prefers-color-scheme: dark) { body { color: #f3e9dc; background: #1d1712; } a { color: #f0c27a; } }
  </style>
</head>
<body>
  <h1>ツイッ棚 プライバシーポリシー</h1>
  <p>最終更新日：2026年10月2日</p>
  <p>ツイッ棚（以下「本拡張」）は、Twitter（現 X）のブックマークを整理するための非公式の Chrome 拡張機能です。X Corp. とは関係ありません。</p>
  <h2>扱うデータ</h2>
  <ul>
    <li>x.com であなたが表示したブックマーク一覧と、あなたがブックマークした投稿の情報（本文、投稿者名、画像の URL など）</li>
    <li>あなたが作ったフォルダ・ルール・設定</li>
  </ul>
  <h2>データの保存場所</h2>
  <p>すべてあなたのブラウザの中（拡張機能の保存領域）だけに保存します。開発者のサーバーや第三者に送信することはありません。外部へのデータ送信・販売・広告への利用は一切行いません。</p>
  <h2>通信</h2>
  <p>本拡張は X へ独自にリクエストを送りません。x.com の画面が受け取ったデータを、その場で読み取るだけです。本棚画面で画像を表示するときに、X の画像配信サーバーから画像を読み込みます。</p>
  <h2>AI 分類</h2>
  <p>AI 分類は、Chrome に内蔵された AI（Gemini Nano）をあなたの PC の中で動かします。投稿の内容を外部の AI サービスに送ることはありません。</p>
  <h2>データの削除</h2>
  <p>本拡張を削除すると、保存されたデータもすべて削除されます。</p>
  <h2>お問い合わせ</h2>
  <p><a href="https://github.com/nnhr-nunu/TwitTana_Nu/issues">GitHub の Issues</a> からご連絡ください。</p>

  <hr>

  <h1 lang="en">TwitTana Privacy Policy</h1>
  <div lang="en">
    <p>Last updated: October 2, 2026</p>
    <p>TwitTana (“the extension”) is an unofficial Chrome extension for organizing your X (formerly Twitter) bookmarks. It is not affiliated with X Corp.</p>
    <h2>Data we handle</h2>
    <ul>
      <li>Bookmark lists you view on x.com and posts you bookmark (text, author names, image URLs, etc.)</li>
      <li>Folders, rules, and settings you create</li>
    </ul>
    <h2>Where data is stored</h2>
    <p>Everything is stored only inside your browser (the extension’s storage). Nothing is sent to the developer or any third party. We never transmit, sell, or use your data for advertising.</p>
    <h2>Network</h2>
    <p>The extension never sends its own requests to X. It only reads data that the x.com page has already received. The shelf page loads images from X’s image servers to display them.</p>
    <h2>AI sorting</h2>
    <p>AI sorting runs Chrome’s built-in AI (Gemini Nano) on your PC. Post content is never sent to external AI services.</p>
    <h2>Deleting data</h2>
    <p>Removing the extension deletes all stored data.</p>
    <h2>Contact</h2>
    <p>Please use <a href="https://github.com/nnhr-nunu/TwitTana_Nu/issues">GitHub Issues</a>.</p>
  </div>
</body>
</html>
```

`docs/index.html`:

```html
<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ツイッ棚 – X のブックマークをフォルダ整理（非公式）</title>
  <style>
    body { max-width: 720px; margin: 0 auto; padding: 24px 16px; font-family: system-ui, sans-serif; line-height: 1.7; color: #2b2118; background: #fffaf3; }
    @media (prefers-color-scheme: dark) { body { color: #f3e9dc; background: #1d1712; } a { color: #f0c27a; } }
  </style>
</head>
<body>
  <h1>ツイッ棚</h1>
  <p>Twitter（現 X）のブックマークを、自分で作ったフォルダに整理して見返すための Chrome 拡張です。X Premium は不要です。データはすべてあなたのブラウザの中だけに保存されます。</p>
  <ul>
    <li>ブクマした瞬間にフォルダを選べる</li>
    <li>ルールや Chrome 内蔵 AI で自動振り分け</li>
    <li>「今日の積みツイ崩し」で、溜まったブクマを毎日少しずつ見返せる</li>
  </ul>
  <p><a href="./privacy.html">プライバシーポリシー</a> ・ <a href="https://github.com/nnhr-nunu/TwitTana_Nu">ソースコード（GitHub）</a></p>
  <p>X Corp. とは関係のない非公式ツールです。</p>
</body>
</html>
```

`docs/.nojekyll` は空のファイルとして作る。

`src/config.ts` の `privacy` を `"https://nnhr-nunu.github.io/TwitTana_Nu/privacy.html"` にする（`donate` は空のまま）。

- [ ] **Step 2: ストアの掲載文を書く**

`docs/store/listing.md`:

```markdown
# Chrome ウェブストア 掲載文

## 名前

- 日本語: ツイッ棚 – X のブックマークをフォルダ整理（非公式）
- English: TwitTana – Bookmark folders for X (unofficial)

## 短い説明（132 文字以内）

- 日本語: Twitter（現 X）のブクマを無料でフォルダ整理。ブクマした瞬間に振り分け、ルールと AI で自動整理、毎日の見返しも。データはブラウザ内だけ。
- English: Organize X (Twitter) bookmarks into folders for free. Sort as you bookmark, auto-sort with rules and on-device AI. Data stays local.

## 詳しい説明（日本語）

X のブックマーク、放り込みっぱなしになっていませんか？
ツイッ棚は、Twitter（現 X）のブックマークを自分で作ったフォルダに整理して、あとで見返せるようにする拡張機能です。X Premium は必要ありません。

■ できること
・ブクマした瞬間に、小さなメニューでフォルダを選べる
・X のブックマーク画面をスクロールするだけで、これまでのブクマも取り込める
・キーワード・投稿者・ハッシュタグ・リンク先・画像の有無で自動振り分け
・Chrome 内蔵 AI で、未整理のブクマを自動でフォルダへ（対応 PC のみ）
・「今日の積みツイ崩し」：過去のブクマを毎日少しずつ見返せる
・X でブクマを外しても、ツイッ棚には残る
・検索、並べ替え、まとめて操作、JSON での書き出し・読み込み

■ 安心して使えるように
・データはすべてあなたのブラウザの中だけに保存。外部には送りません
・X に独自のリクエストを送らず、画面が受け取ったデータを読むだけ
・ソースコードは GitHub で公開

※ X Corp. とは関係のない非公式ツールです。

## 権限の説明（審査用）

- unlimitedStorage: 利用者のブックマーク（数千〜数万件になりうる）を、ブラウザ内の IndexedDB に保存するため。
- x.com へのアクセス（content script）: 利用者が x.com で表示したブックマーク一覧と、ブックマークした投稿の情報を読み取り、フォルダ選択メニューを表示するため。X へ独自のリクエストは送らない。

## データの扱い（プライバシー欄）

- 収集するデータ: なし（扱うデータはすべて利用者のブラウザ内に保存され、開発者や第三者に送信されない）
- 単一用途: X のブックマークの整理と見返し
- リモートコード: 使用しない

## スクリーンショット（1280×800）

1. 本棚画面（フォルダ別の一覧と今日の積みツイ崩し）
2. タイムラインでブクマした直後のフォルダ選択メニュー
3. フォルダとルールの編集
4. 設定（AI 分類・バックアップ）
```

- [ ] **Step 3: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし

- [ ] **Step 4: Commit**

```bash
git add docs/.nojekyll docs/index.html docs/privacy.html docs/store/listing.md src/config.ts
git commit -m "公開準備: プライバシーポリシー・紹介ページ・ストア掲載文" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: X の仕様変更に備える道具

**Files:**
- Create: `src/devtools/anonymize.ts`、Test: `src/devtools/anonymize.test.ts`、`scripts/anonymize-fixture.ts`、`docs/maintenance.md`
- Modify: `src/entrypoints/x-hook.content.ts`（開発版だけ生データを出す）、`package.json`（`anonymize` スクリプト）、`tsconfig.json`（`allowImportingTsExtensions`）

**Interfaces:**
- Produces: `anonymize(input: unknown): unknown`

- [ ] **Step 1: 失敗するテストを書く**

`src/devtools/anonymize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { anonymize } from "./anonymize";

const sample = {
  __typename: "Tweet",
  rest_id: "1973000000000000500",
  core: { user_results: { result: { core: { screen_name: "realname", name: "本名太郎" } } } },
  legacy: {
    full_text: "秘密の本文 https://t.co/abc",
    entities: { urls: [{ url: "https://t.co/abc", expanded_url: "https://private.example.com/x" }], media: [{ type: "photo", media_url_https: "https://pbs.twimg.com/media/A.jpg" }] },
    favorite_count: 12,
    possibly_sensitive: false,
  },
  entries: [{ entryId: "tweet-1973000000000000500", sortIndex: "1868000000000000002" }, { sortIndex: "999" }],
};

describe("anonymize", () => {
  const out = JSON.stringify(anonymize(sample));

  it("元の文字列（本文・名前・URL・ID）が残らない", () => {
    for (const secret of ["realname", "本名太郎", "秘密の本文", "private.example.com", "1973000000000000500", "1868000000000000002", "pbs.twimg.com"]) {
      expect(out).not.toContain(secret);
    }
  });

  it("構造を表す値（__typename・type）と数値・真偽値は残す", () => {
    const a = anonymize(sample) as typeof sample;
    expect(a.__typename).toBe("Tweet");
    expect(a.legacy.entities.media[0]?.type).toBe("photo");
    expect(a.legacy.favorite_count).toBe(12);
    expect(a.legacy.possibly_sensitive).toBe(false);
  });

  it("同じ文字列は同じ置き換え。数字の文字列は大小関係を保つ", () => {
    const a = anonymize(sample) as typeof sample;
    expect(a.legacy.entities.urls[0]?.url).toBe(a.legacy.full_text.split(" ")[1]);
    const [first, second] = a.entries;
    expect(BigInt(first?.sortIndex ?? "0") > BigInt(second?.sortIndex ?? "0")).toBe(true);
    expect(a.legacy.entities.urls[0]?.expanded_url.startsWith("https://example.com/")).toBe(true);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/devtools/anonymize.test.ts`
Expected: FAIL（`./anonymize` が見つからない）

- [ ] **Step 3: 実装する**

`src/devtools/anonymize.ts`（node から直接動かすので、他のファイルを import しない）:

```ts
/** 値を残すキー（データの構造を表すだけで、個人の情報を含まないもの） */
const KEEP_KEYS = new Set(["__typename", "type", "entryType", "itemType", "cursorType", "content_type", "displayType", "tweetDisplayType", "role"]);
const NUMERIC = /^\d{4,}$/;
const BASE_ID = 1900000000000000000n;

function compareNumeric(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

function collectNumbers(node: unknown, key: string, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const v of node) collectNumbers(v, key, out);
  } else if (typeof node === "object" && node !== null) {
    for (const [k, v] of Object.entries(node)) collectNumbers(v, k, out);
  } else if (typeof node === "string" && !KEEP_KEYS.has(key) && NUMERIC.test(node)) {
    out.add(node);
  }
}

/**
 * X の返事 JSON から個人の情報を取り除く（テスト用データにするため）。
 * - 4 桁以上の数字の文字列は、大小関係を保った架空の数字に
 * - URL は https://example.com/N に、それ以外の文字列は text-N に（同じ文字列は同じ置き換え）
 * - 構造を表すキーの値・数値・真偽値・null はそのまま
 */
export function anonymize(input: unknown): unknown {
  const numbers = new Set<string>();
  collectNumbers(input, "", numbers);
  const numberMap = new Map([...numbers].sort(compareNumeric).map((n, i) => [n, String(BASE_ID + BigInt(i) * 1000n)]));
  const stringMap = new Map<string, string>();

  const replaceString = (s: string): string => {
    const mapped = numberMap.get(s);
    if (mapped) return mapped;
    let replaced = stringMap.get(s);
    if (!replaced) {
      const n = stringMap.size + 1;
      replaced = /^https?:\/\//.test(s) ? `https://example.com/${n}` : `text-${n}`;
      stringMap.set(s, replaced);
    }
    return replaced;
  };

  const walk = (node: unknown, key: string): unknown => {
    if (Array.isArray(node)) return node.map((v) => walk(v, key));
    if (typeof node === "object" && node !== null) {
      return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v, k)]));
    }
    if (typeof node === "string" && !KEEP_KEYS.has(key)) {
      // 本文中の URL も置き換える（短縮 URL と本文の対応を保つ）
      if (!numberMap.has(node) && /\shttps?:\/\//.test(node)) {
        return node
          .split(/(\s+)/)
          .map((part) => (/^https?:\/\//.test(part) ? replaceString(part) : /^\s+$/.test(part) ? part : replaceString(part)))
          .join("");
      }
      return replaceString(node);
    }
    return node;
  };

  return walk(input, "");
}
```

`scripts/anonymize-fixture.ts`（Node 24 は .ts をそのまま動かせる）:

```ts
// X の返事 JSON を匿名化してテスト用データにする。npm run anonymize -- <入力.json> <出力.json>
import { readFile, writeFile } from "node:fs/promises";
import { anonymize } from "../src/devtools/anonymize.ts";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("使い方: npm run anonymize -- <入力.json> <出力.json>");
  process.exit(1);
}
const json: unknown = JSON.parse(await readFile(input, "utf8"));
await writeFile(output, `${JSON.stringify(anonymize(json), null, 2)}\n`, "utf8");
console.log(`匿名化して ${output} に書き出しました。中身に個人の情報が残っていないか、目でも確かめてからコミットしてください。`);
```

`package.json` の `scripts` に `"anonymize": "node scripts/anonymize-fixture.ts"` を足す。

`tsconfig.json` の `compilerOptions` に `"allowImportingTsExtensions": true` を足す（`scripts/anonymize-fixture.ts` が `.ts` 付きで import するため）。

`src/entrypoints/x-hook.content.ts` の `handle` の中、`readJson().then(` の成功側を次に置き換える（`isBookmarkListOp` を `../x/graphql` から import する）:

```ts
        (json) => {
          // 開発版だけ：localStorage に twittana:dump=1 があれば、ブクマ一覧の生データをコンソールに出す
          if (import.meta.env.DEV && isBookmarkListOp(op) && window.localStorage.getItem("twittana:dump") === "1") {
            console.debug("[twittana:raw]", op, JSON.stringify(json));
          }
          post(core.onResponse(op, json));
        },
```

- [ ] **Step 4: 手順書を書く**

`docs/maintenance.md`:

````markdown
# X の仕様が変わったときの直し方

ブクマ画面に「X の仕様が変わったようです」と出たり、取り込み件数が増えなくなったら、読み取り係（`src/x/parse.ts`）を直す。

## 1. 今の X の返事を保存する

1. `npm run dev` で開発版を動かす（開発版の拡張を Chrome に読み込む）
2. x.com を開き、DevTools のコンソールで `localStorage.setItem("twittana:dump", "1")` を実行して再読み込み
3. ブックマーク画面を開くと、コンソールに `[twittana:raw] Bookmarks {...}` が出る。JSON 部分をコピーして、リポジトリの外（例: デスクトップ）に `raw.json` として保存する
4. 終わったら `localStorage.removeItem("twittana:dump")`

## 2. 匿名化してテスト用データにする

```bash
npm run anonymize -- ~/Desktop/raw.json src/x/__fixtures__/bookmarks-YYYYMMDD.json
```

出力を開き、本文・名前・URL・ID が残っていないか目でも確かめる。**匿名化前の raw.json は絶対にコミットしない。**

## 3. テストを足して直す

`src/x/parse.test.ts` に、保存した JSON を `extractPosts(json, "bookmarks")` にかけて件数と各項目が埋まることを確かめるテストを足し、通るように `src/x/parse.ts` を直す。
````

- [ ] **Step 5: すべて通ることを確かめる**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし / `npm run build` → 成功
Run: `node -e "require('fs').writeFileSync(process.env.TEMP + '/tt-sample.json', JSON.stringify({a:'秘密',b:'12345'}))"` のあと `npm run anonymize -- "$TEMP/tt-sample.json" "$TEMP/tt-out.json"` → 「匿名化して…」と出て、出力に「秘密」が無い（確かめたら 2 つの一時ファイルを消す）

- [ ] **Step 6: Commit**

```bash
git add src/devtools scripts/anonymize-fixture.ts docs/maintenance.md src/entrypoints/x-hook.content.ts package.json tsconfig.json
git commit -m "保守: X の返事の保存と匿名化の道具" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: 手で確かめる表と残りの作業の整理

**Files:**
- Modify: `docs/manual-test.md`、`task.md`、`README.md`

- [ ] **Step 1: 手で確かめる表に足す**

`docs/manual-test.md` の末尾に追記:

```markdown
## AI 分類・言語・公開前

| # | 操作 | 期待すること |
|---|---|---|
| 1 | 設定の「AI 分類」（AI 対応の PC の Chrome） | 状態が出る。未取得なら「AI を準備する」でダウンロードの % が進み、終わると「この PC で使えます」とオンのチェックが出る |
| 2 | フォルダに説明を書き、未整理がある状態で本棚タブを開く | 「AI が振り分け中…」と進み、終わると件数が出る。AI が入れた投稿に「AI」の印 |
| 3 | 「AI が入れたもの」で絞り込み、違うものを手で外す | 外した投稿は、その後 AI が入れ直さない |
| 4 | AI 非対応の環境（Edge など） | 「この PC・ブラウザでは AI 分類は使えません」と出て、エラーにならない |
| 5 | 設定の表示言語を English に | 本棚画面も、x.com 上のメニューと件数表示も英語になる |
| 6 | `chrome://extensions` の表示 | アイコンが本棚の絵。名前がブラウザの言語に合っている |
| 7 | 設定の「プライバシーポリシー」 | GitHub Pages のページが開く |
| 8 | `npm run zip` | `.output/` にストア提出用の zip ができる |
```

- [ ] **Step 2: README と task.md を更新する**

`README.md` の「## 開発」の末尾に足す:

```markdown
アイコンを描き直したら `npm run icons`。X の仕様が変わったときは [`docs/maintenance.md`](./docs/maintenance.md)。
```

`README.md` の「## 状態」の本文の「設計中。」を「第1弾を実装済み（公開前の確認中）。」に置き換える。

`task.md` の「今やっていること」を次にする:

```markdown
- [x] 計画1〜4（`docs/superpowers/plans/`）
- [ ] 手での確認（`docs/manual-test.md` の全表）。実際の X アカウントが要るのでユーザーが行う
- [ ] 実際の X の返事を匿名化してテスト用データにする（`docs/maintenance.md`）。ユーザーの X アカウントが要る
```

`task.md` の「保留（ユーザーが決める）」に足す:

```markdown
- GitHub Pages を有効にする（リポジトリの Settings → Pages → Deploy from a branch → `main` / `/docs`）。プライバシーポリシーの URL がこれで開くようになる
- ストアに出すスクリーンショット 4 枚（`docs/store/listing.md`）
```

- [ ] **Step 3: Commit・push**

```bash
git add docs/manual-test.md README.md task.md
git commit -m "公開準備: 手で確かめる表と残りの作業を整理" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```
