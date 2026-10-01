import { describe, expect, it } from "vitest";
import { makePost } from "../test/factories";
import { inView, matchesQuery, selectPosts, viewCounts, viewKey } from "./views";

const unsorted = makePost({ id: "1", text: "Unity の講座", bookmarkOrder: "10", postedAt: "2026-01-03T00:00:00.000Z" });
const inA = makePost({ id: "2", folders: [{ folderId: "a", by: "manual" }], bookmarkOrder: "30", postedAt: "2026-01-01T00:00:00.000Z" });
const byAi = makePost({ id: "3", folders: [{ folderId: "b", by: "ai" }], removedOnX: true, bookmarkOrder: "20", postedAt: "2026-01-02T00:00:00.000Z" });
const hidden = makePost({ id: "4", hidden: true, folders: [{ folderId: "a", by: "manual" }] });
const all = [unsorted, inA, byAi, hidden];

describe("inView", () => {
  it("非表示は『非表示にしたもの』にだけ出る", () => {
    expect(inView(hidden, { kind: "all" })).toBe(false);
    expect(inView(hidden, { kind: "folder", folderId: "a" })).toBe(false);
    expect(inView(hidden, { kind: "hidden" })).toBe(true);
    expect(inView(unsorted, { kind: "hidden" })).toBe(false);
  });
  it("未整理・AI・解除済み・フォルダ", () => {
    expect(inView(unsorted, { kind: "unsorted" })).toBe(true);
    expect(inView(inA, { kind: "unsorted" })).toBe(false);
    expect(inView(byAi, { kind: "ai" })).toBe(true);
    expect(inView(inA, { kind: "ai" })).toBe(false);
    expect(inView(byAi, { kind: "removed" })).toBe(true);
    expect(inView(inA, { kind: "folder", folderId: "a" })).toBe(true);
    expect(inView(inA, { kind: "folder", folderId: "b" })).toBe(false);
  });
});

describe("matchesQuery", () => {
  it("本文・表示名・@名・引用元の本文を、全角半角と大文字小文字を区別せずに探す", () => {
    const p = makePost({ text: "ﾕﾆﾃｨ講座", author: { id: "u", handle: "GameDev", name: "ゲーム太郎", avatarUrl: "" }, quoted: { id: "9", authorHandle: "x", text: "元ネタ" } });
    expect(matchesQuery(p, "ユニティ")).toBe(true);
    expect(matchesQuery(p, "gamedev")).toBe(true);
    expect(matchesQuery(p, "太郎")).toBe(true);
    expect(matchesQuery(p, "元ネタ")).toBe(true);
    expect(matchesQuery(p, "ない言葉")).toBe(false);
    expect(matchesQuery(p, "  ")).toBe(true);
  });
});

describe("selectPosts", () => {
  it("絞り込んでから並べる", () => {
    const ids = (sort: Parameters<typeof selectPosts>[1]["sort"]) => selectPosts(all, { view: { kind: "all" }, query: "", sort }).map((p) => p.id);
    expect(ids("bookmark-desc")).toEqual(["2", "3", "1"]);
    expect(ids("bookmark-asc")).toEqual(["1", "3", "2"]);
    expect(ids("posted-desc")).toEqual(["1", "3", "2"]);
    expect(ids("posted-asc")).toEqual(["2", "3", "1"]);
    expect(selectPosts(all, { view: { kind: "all" }, query: "unity", sort: "bookmark-desc" }).map((p) => p.id)).toEqual(["1"]);
  });
  it("元の配列を変えない", () => {
    const copy = [...all];
    selectPosts(all, { view: { kind: "all" }, query: "", sort: "posted-asc" });
    expect(all).toEqual(copy);
  });
});

describe("viewCounts", () => {
  it("非表示を除いて数え、非表示は別に数える", () => {
    expect(viewCounts(all)).toEqual({ all: 3, unsorted: 1, ai: 1, removed: 1, hidden: 1, folders: { a: 1, b: 1 } });
  });
});

describe("viewKey", () => {
  it("フォルダは ID ごとに別のキー", () => {
    expect(viewKey({ kind: "all" })).toBe("all");
    expect(viewKey({ kind: "folder", folderId: "x" })).toBe("folder:x");
  });
});
