import { describe, expect, it } from "vitest";
import { makePost } from "../test/factories";
import { compareByBookmark, compareByPosted, compareNumericStrings } from "./order";

describe("compareNumericStrings", () => {
  it("桁数が違っても数として比べる", () => {
    expect(compareNumericStrings("999", "1000")).toBeLessThan(0);
    expect(compareNumericStrings("1000", "999")).toBeGreaterThan(0);
  });
  it("同じ値なら 0", () => {
    expect(compareNumericStrings("1868000000000000000", "1868000000000000000")).toBe(0);
  });
  it("先頭の 0 は無視する", () => {
    expect(compareNumericStrings("0012", "12")).toBe(0);
  });
});

describe("compareByBookmark", () => {
  it("両方に並び値があれば並び値で古い順", () => {
    const a = makePost({ id: "1", bookmarkOrder: "999" });
    const b = makePost({ id: "2", bookmarkOrder: "1000" });
    expect([b, a].sort(compareByBookmark).map((p) => p.id)).toEqual(["1", "2"]);
  });
  it("並び値が無ければ取り込んだ日時で古い順", () => {
    const a = makePost({ id: "1", capturedAt: "2026-03-02T00:00:00.000Z" });
    const b = makePost({ id: "2", capturedAt: "2026-03-01T00:00:00.000Z" });
    expect([a, b].sort(compareByBookmark).map((p) => p.id)).toEqual(["2", "1"]);
  });
  it("同じなら投稿 ID で古い順", () => {
    const a = makePost({ id: "20" });
    const b = makePost({ id: "3" });
    expect([a, b].sort(compareByBookmark).map((p) => p.id)).toEqual(["3", "20"]);
  });
});

describe("compareByPosted", () => {
  it("投稿日で古い順", () => {
    const a = makePost({ id: "1", postedAt: "2026-05-01T00:00:00.000Z" });
    const b = makePost({ id: "2", postedAt: "2026-04-01T00:00:00.000Z" });
    expect([a, b].sort(compareByPosted).map((p) => p.id)).toEqual(["2", "1"]);
  });
});
