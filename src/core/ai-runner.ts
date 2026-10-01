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
