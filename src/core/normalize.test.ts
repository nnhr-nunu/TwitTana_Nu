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
