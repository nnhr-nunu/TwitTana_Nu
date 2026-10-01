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
