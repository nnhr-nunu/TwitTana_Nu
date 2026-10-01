import { afterEach, describe, expect, it } from "vitest";
import { en } from "./en";
import { getLanguage, ja, resolveLanguage, setLanguage, t } from "./index";

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
