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
