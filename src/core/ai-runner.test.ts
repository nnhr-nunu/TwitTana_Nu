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
