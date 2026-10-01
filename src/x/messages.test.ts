import { describe, expect, it } from "vitest";
import { makeCaptured } from "../test/factories";
import { HOOK_SOURCE, isCapturedPost, isHookMessage, MAX_POSTS_PER_MESSAGE } from "./messages";

describe("isCapturedPost", () => {
  it("正しい形なら true", () => {
    expect(isCapturedPost(makeCaptured())).toBe(true);
    expect(isCapturedPost(makeCaptured({ quoted: { id: "1", authorHandle: "a", text: "t" }, bookmarkOrder: "5", partial: true }))).toBe(true);
  });
  it("形が違えば false", () => {
    expect(isCapturedPost({ ...makeCaptured(), id: "abc" })).toBe(false);
    expect(isCapturedPost({ ...makeCaptured(), url: "https://evil.example/1" })).toBe(false);
    expect(isCapturedPost({ ...makeCaptured(), media: [{ type: "audio", url: "u", thumbUrl: "t" }] })).toBe(false);
    expect(isCapturedPost({ ...makeCaptured(), text: "あ".repeat(20001) })).toBe(false);
    expect(isCapturedPost(null)).toBe(false);
  });
});

describe("isHookMessage", () => {
  it("4 種類のメッセージを受け付ける", () => {
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmarks-seen", posts: [makeCaptured()] })).toBe(true);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmark-added", postId: "1", post: null })).toBe(true);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmark-added", postId: "1", post: makeCaptured({ id: "1" }) })).toBe(true);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmark-removed", postId: "1" })).toBe(true);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "parse-error", op: "Bookmarks" })).toBe(true);
  });
  it("差出人・種類・中身・件数が違えば捨てる", () => {
    expect(isHookMessage({ source: "other", type: "parse-error", op: "x" })).toBe(false);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "delete-all" })).toBe(false);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmark-removed", postId: "../1" })).toBe(false);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmarks-seen", posts: [{ id: "1" }] })).toBe(false);
    const tooMany = Array.from({ length: MAX_POSTS_PER_MESSAGE + 1 }, (_, i) => makeCaptured({ id: String(i + 1) }));
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmarks-seen", posts: tooMany })).toBe(false);
  });
});
