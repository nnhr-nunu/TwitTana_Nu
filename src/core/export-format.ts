import type { Folder, Post, Rule } from "./types";

export const EXPORT_APP = "twittana";
export const EXPORT_SCHEMA_VERSION = 1;

export type ExportFile = {
  app: typeof EXPORT_APP;
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  folders: Folder[];
  rules: Rule[];
  posts: Post[];
};

export type ImportError = "not-json" | "wrong-app" | "unsupported-version" | "invalid-shape";

export function buildExport(data: { folders: Folder[]; rules: Rule[]; posts: Post[] }, now: string): ExportFile {
  return { app: EXPORT_APP, schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: now, ...data };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === "boolean";

const ASSIGNED_BY = ["manual", "rule", "ai"];
const MEDIA = ["any", "photo", "video"];

function isCondition(v: unknown): boolean {
  if (!isObj(v)) return false;
  switch (v.kind) {
    case "keyword":
      return isStr(v.value);
    case "author":
      return isStr(v.handle);
    case "hashtag":
      return isStr(v.tag);
    case "domain":
      return isStr(v.domain);
    case "hasMedia":
      return MEDIA.includes(v.media as string);
    default:
      return false;
  }
}

function isFolder(v: unknown): boolean {
  return isObj(v) && isStr(v.id) && isStr(v.name) && isStr(v.description) && isNum(v.order) && isStr(v.createdAt);
}

function isRule(v: unknown): boolean {
  return (
    isObj(v) &&
    isStr(v.id) &&
    isStr(v.folderId) &&
    Array.isArray(v.conditions) &&
    v.conditions.every(isCondition) &&
    isBool(v.enabled) &&
    isNum(v.order)
  );
}

function isPost(v: unknown): boolean {
  if (!isObj(v)) return false;
  const a = v.author;
  const r = v.review;
  return (
    isStr(v.id) &&
    isStr(v.url) &&
    isStr(v.text) &&
    isStr(v.postedAt) &&
    isStr(v.capturedAt) &&
    isObj(a) &&
    isStr(a.id) &&
    isStr(a.handle) &&
    isStr(a.name) &&
    isStr(a.avatarUrl) &&
    Array.isArray(v.media) &&
    Array.isArray(v.links) &&
    Array.isArray(v.hashtags) &&
    v.hashtags.every(isStr) &&
    Array.isArray(v.folders) &&
    v.folders.every((f) => isObj(f) && isStr(f.folderId) && ASSIGNED_BY.includes(f.by as string)) &&
    isBool(v.sortedByUser) &&
    isBool(v.removedOnX) &&
    isBool(v.hidden) &&
    isObj(r) &&
    isNum(r.count)
  );
}

/** 書き出しファイルの文字列を検査して読み込む。だめなら理由を返す */
export function parseImport(text: string): { ok: true; file: ExportFile } | { ok: false; error: ImportError } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "not-json" };
  }
  if (!isObj(data) || data.app !== EXPORT_APP) return { ok: false, error: "wrong-app" };
  if (data.schemaVersion !== EXPORT_SCHEMA_VERSION) return { ok: false, error: "unsupported-version" };
  const { folders, rules, posts } = data;
  if (
    !isStr(data.exportedAt) ||
    !Array.isArray(folders) ||
    !Array.isArray(rules) ||
    !Array.isArray(posts) ||
    !folders.every(isFolder) ||
    !rules.every(isRule) ||
    !posts.every(isPost)
  ) {
    return { ok: false, error: "invalid-shape" };
  }
  return { ok: true, file: data as unknown as ExportFile };
}
