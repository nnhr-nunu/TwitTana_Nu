import { describe, expect, it } from "vitest";
import { makePost } from "../test/factories";
import { buildExport, parseImport } from "./export-format";
import type { Folder, Rule } from "./types";

const folder: Folder = { id: "f1", name: "ゲーム開発", description: "", order: 0, createdAt: "2026-10-01T00:00:00.000Z" };
const rule: Rule = { id: "r1", folderId: "f1", conditions: [{ kind: "keyword", value: "unity" }], enabled: true, order: 0 };

describe("buildExport → parseImport", () => {
  it("書き出したものはそのまま読み込める", () => {
    const file = buildExport({ folders: [folder], rules: [rule], posts: [makePost({ id: "1" })] }, "2026-10-02T00:00:00.000Z");
    expect(file).toMatchObject({ app: "twittana", schemaVersion: 1, exportedAt: "2026-10-02T00:00:00.000Z" });
    const result = parseImport(JSON.stringify(file));
    expect(result).toEqual({ ok: true, file });
  });
});

describe("parseImport の失敗", () => {
  it("JSON でない", () => {
    expect(parseImport("{壊れた")).toEqual({ ok: false, error: "not-json" });
  });
  it("別のアプリのファイル", () => {
    expect(parseImport(JSON.stringify({ app: "other", schemaVersion: 1, folders: [], rules: [], posts: [] }))).toEqual({ ok: false, error: "wrong-app" });
  });
  it("未対応の版", () => {
    expect(parseImport(JSON.stringify({ app: "twittana", schemaVersion: 99, exportedAt: "x", folders: [], rules: [], posts: [] }))).toEqual({ ok: false, error: "unsupported-version" });
  });
  it("形が違う（投稿に本文が無い）", () => {
    const bad = { app: "twittana", schemaVersion: 1, exportedAt: "x", folders: [], rules: [], posts: [{ id: "1" }] };
    expect(parseImport(JSON.stringify(bad))).toEqual({ ok: false, error: "invalid-shape" });
  });
  it("形が違う（ルールの条件の種類が不明）", () => {
    const bad = { app: "twittana", schemaVersion: 1, exportedAt: "x", folders: [folder], rules: [{ ...rule, conditions: [{ kind: "magic" }] }], posts: [] };
    expect(parseImport(JSON.stringify(bad))).toEqual({ ok: false, error: "invalid-shape" });
  });
  it("配列でない", () => {
    expect(parseImport(JSON.stringify({ app: "twittana", schemaVersion: 1, exportedAt: "x", folders: {}, rules: [], posts: [] }))).toEqual({ ok: false, error: "invalid-shape" });
  });
});
