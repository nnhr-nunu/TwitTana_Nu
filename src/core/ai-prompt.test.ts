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
