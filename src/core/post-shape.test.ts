import { describe, expect, it } from "vitest";
import { makeCaptured } from "../test/factories";
import { clampCaptured, isAllowedMediaUrl, isCapturedPostShape, isPostUrl, POST_LIMITS } from "./post-shape";

describe("isAllowedMediaUrl / isPostUrl", () => {
  it("X の画像・動画配信の https だけ許す", () => {
    expect(isAllowedMediaUrl("https://pbs.twimg.com/media/A.jpg?name=small")).toBe(true);
    expect(isAllowedMediaUrl("https://abs.twimg.com/sticky/default_profile_images/a.png")).toBe(true);
    expect(isAllowedMediaUrl("https://video.twimg.com/v.mp4")).toBe(true);
    expect(isAllowedMediaUrl("http://pbs.twimg.com/a.jpg")).toBe(false);
    expect(isAllowedMediaUrl("https://tracker.example/a.gif")).toBe(false);
    expect(isAllowedMediaUrl("javascript:alert(1)")).toBe(false);
  });
  it("投稿の URL は https://x.com だけ", () => {
    expect(isPostUrl("https://x.com/a/status/1")).toBe(true);
    expect(isPostUrl("https://x.com.evil.example/a")).toBe(false);
    expect(isPostUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("clampCaptured", () => {
  it("長い本文・多すぎる配列を上限で切り、許されない画像を外す", () => {
    const p = clampCaptured(
      makeCaptured({
        text: "あ".repeat(POST_LIMITS.text + 10),
        hashtags: Array.from({ length: POST_LIMITS.hashtags + 5 }, (_, i) => `t${i}`),
        links: Array.from({ length: POST_LIMITS.links + 5 }, (_, i) => ({ url: `https://e.example/${i}`, domain: "e.example" })),
        media: [
          { type: "photo", url: "https://pbs.twimg.com/media/A.jpg", thumbUrl: "https://pbs.twimg.com/media/A.jpg?name=small" },
          { type: "photo", url: "https://tracker.example/b.jpg", thumbUrl: "https://tracker.example/b.jpg" },
        ],
        author: { id: "u", handle: "h", name: "n", avatarUrl: "https://tracker.example/me.png" },
        quoted: { id: "9", authorHandle: "q", text: "い".repeat(POST_LIMITS.text + 1) },
      }),
    );
    expect(p.text).toHaveLength(POST_LIMITS.text);
    expect(p.hashtags).toHaveLength(POST_LIMITS.hashtags);
    expect(p.links).toHaveLength(POST_LIMITS.links);
    expect(p.media.map((m) => m.url)).toEqual(["https://pbs.twimg.com/media/A.jpg"]);
    expect(p.author.avatarUrl).toBe("");
    expect(p.quoted?.text).toHaveLength(POST_LIMITS.text);
    expect(isCapturedPostShape(p)).toBe(true);
  });
});

describe("isCapturedPostShape", () => {
  it("正しい形なら true", () => {
    expect(isCapturedPostShape(makeCaptured())).toBe(true);
    expect(isCapturedPostShape(makeCaptured({ quoted: { id: "1", authorHandle: "a", text: "t" }, bookmarkOrder: "5", partial: true }))).toBe(true);
    expect(isCapturedPostShape(makeCaptured({ author: { id: "", handle: "", name: "", avatarUrl: "" } }))).toBe(true);
  });
  it("形・URL・上限が違えば false", () => {
    expect(isCapturedPostShape({ ...makeCaptured(), id: "abc" })).toBe(false);
    expect(isCapturedPostShape({ ...makeCaptured(), url: "https://evil.example/1" })).toBe(false);
    expect(isCapturedPostShape({ ...makeCaptured(), media: [{ type: "audio", url: "u", thumbUrl: "t" }] })).toBe(false);
    expect(isCapturedPostShape({ ...makeCaptured(), media: [null] })).toBe(false);
    expect(isCapturedPostShape({ ...makeCaptured(), links: [null] })).toBe(false);
    expect(isCapturedPostShape({ ...makeCaptured(), bookmarkOrder: 5 })).toBe(false);
    expect(isCapturedPostShape({ ...makeCaptured(), text: "あ".repeat(POST_LIMITS.text + 1) })).toBe(false);
    expect(isCapturedPostShape(makeCaptured({ author: { id: "u", handle: "h", name: "n", avatarUrl: "https://tracker.example/a.png" } }))).toBe(false);
    expect(isCapturedPostShape(null)).toBe(false);
  });
});
