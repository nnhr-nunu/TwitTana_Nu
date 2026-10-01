import { describe, expect, it } from "vitest";
import { makeCaptured } from "../test/factories";
import { HOOK_SOURCE, isHookMessage, MAX_POSTS_PER_MESSAGE, splitValidPosts } from "./messages";

describe("isHookMessage", () => {
  it("4 種類のメッセージを受け付ける（投稿の中身は splitValidPosts で調べる）", () => {
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmarks-seen", posts: [makeCaptured(), { id: "壊れた" }] })).toBe(true);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmark-added", postId: "1", post: null })).toBe(true);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmark-added", postId: "1", post: makeCaptured({ id: "1" }) })).toBe(true);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmark-removed", postId: "1" })).toBe(true);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "parse-error", op: "Bookmarks" })).toBe(true);
  });
  it("差出人・種類・ID・件数が違えば捨てる", () => {
    expect(isHookMessage({ source: "other", type: "parse-error", op: "x" })).toBe(false);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "delete-all" })).toBe(false);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmark-removed", postId: "../1" })).toBe(false);
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmark-added", postId: "1", post: makeCaptured({ id: "2" }) })).toBe(false);
    const tooMany = Array.from({ length: MAX_POSTS_PER_MESSAGE + 1 }, (_, i) => makeCaptured({ id: String(i + 1) }));
    expect(isHookMessage({ source: HOOK_SOURCE, type: "bookmarks-seen", posts: tooMany })).toBe(false);
  });
});

describe("splitValidPosts", () => {
  it("正しい投稿だけを残し、捨てた数を返す（1 件の不正で全部を捨てない）", () => {
    const good = makeCaptured({ id: "1" });
    expect(splitValidPosts([good, { id: "壊れた" }, null])).toEqual({ valid: [good], invalid: 2 });
  });
});
