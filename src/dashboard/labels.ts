import type { ConditionKind } from "../core/condition-input";
import type { ImportError } from "../core/export-format";
import type { SortKey } from "../core/views";
import type { MessageKey } from "../i18n";

export const SORT_LABEL: Record<SortKey, MessageKey> = {
  "bookmark-desc": "shelf.sort.bookmark-desc",
  "bookmark-asc": "shelf.sort.bookmark-asc",
  "posted-desc": "shelf.sort.posted-desc",
  "posted-asc": "shelf.sort.posted-asc",
};

export const COND_LABEL: Record<ConditionKind, MessageKey> = {
  keyword: "cond.keyword",
  author: "cond.author",
  hashtag: "cond.hashtag",
  domain: "cond.domain",
  hasMedia: "cond.hasMedia",
};

export const MEDIA_LABEL: Record<"any" | "photo" | "video", MessageKey> = {
  any: "cond.media.any",
  photo: "cond.media.photo",
  video: "cond.media.video",
};

export const IMPORT_ERROR_LABEL: Record<ImportError, MessageKey> = {
  "not-json": "settings.importError.not-json",
  "wrong-app": "settings.importError.wrong-app",
  "unsupported-version": "settings.importError.unsupported-version",
  "invalid-shape": "settings.importError.invalid-shape",
};

export const FOLDER_ERROR_LABEL: Record<"empty" | "duplicate", MessageKey> = {
  empty: "folders.error.empty",
  duplicate: "folders.error.duplicate",
};
