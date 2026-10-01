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
