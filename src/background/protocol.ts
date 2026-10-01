import type { CapturedPost, Folder, ParseHealth } from "../core/types";

/** 橋渡し係（x.com のページ内）から裏方への依頼 */
export type BgRequest =
  | { type: "save-posts"; posts: CapturedPost[] }
  | { type: "mark-removed"; postId: string }
  | { type: "report-parse-error"; op: string }
  | { type: "get-picker-state"; postId: string }
  | { type: "set-folder"; postId: string; folderId: string; on: boolean }
  | { type: "create-folder"; name: string; postId?: string }
  | { type: "get-stats" }
  | { type: "refresh-badge" };

export type PickerState = { enabled: boolean; folders: Folder[]; selected: string[] };

export type BgResponseMap = {
  "save-posts": { saved: number; total: number };
  "mark-removed": { ok: true };
  "report-parse-error": { ok: true };
  "get-picker-state": PickerState;
  "set-folder": { selected: string[] };
  "create-folder": { ok: true; folder: Folder; selected: string[] } | { ok: false; error: "empty" | "duplicate" };
  "get-stats": { total: number; health: ParseHealth };
  "refresh-badge": { ok: true };
};

const TYPES = new Set<string>([
  "save-posts",
  "mark-removed",
  "report-parse-error",
  "get-picker-state",
  "set-folder",
  "create-folder",
  "get-stats",
  "refresh-badge",
]);

export function isBgRequest(v: unknown): v is BgRequest {
  return typeof v === "object" && v !== null && TYPES.has((v as { type?: unknown }).type as string);
}
