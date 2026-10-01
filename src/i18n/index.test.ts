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
