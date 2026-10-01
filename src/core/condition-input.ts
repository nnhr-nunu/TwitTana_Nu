import type { Condition } from "./types";

export type ConditionKind = Condition["kind"];
export const CONDITION_KINDS: ConditionKind[] = ["keyword", "author", "hashtag", "domain", "hasMedia"];
export const MEDIA_CHOICES: ("any" | "photo" | "video")[] = ["any", "photo", "video"];

/** ルールの入力欄の中身（種類と、文字の値） */
export type ConditionDraft = { kind: ConditionKind; value: string };

export function emptyDraft(kind: ConditionKind = "keyword"): ConditionDraft {
  return { kind, value: kind === "hasMedia" ? "any" : "" };
}

/** 入力欄の中身を Condition にする。値が空・不正なら null */
export function draftToCondition(d: ConditionDraft): Condition | null {
  const v = d.value.trim();
  switch (d.kind) {
    case "keyword":
      return v ? { kind: "keyword", value: v } : null;
    case "author": {
      const handle = v.replace(/^[@＠]/, "");
      return handle ? { kind: "author", handle } : null;
    }
    case "hashtag": {
      const tag = v.replace(/^[#＃]/, "");
      return tag ? { kind: "hashtag", tag } : null;
    }
    case "domain":
      return v ? { kind: "domain", domain: v } : null;
    case "hasMedia":
      return v === "any" || v === "photo" || v === "video" ? { kind: "hasMedia", media: v } : null;
  }
}

/** 一覧に出す条件の値（画像・動画ありは選択肢の値そのもの） */
export function conditionValue(c: Condition): string {
  switch (c.kind) {
    case "keyword":
      return c.value;
    case "author":
      return `@${c.handle}`;
    case "hashtag":
      return `#${c.tag}`;
    case "domain":
      return c.domain;
    case "hasMedia":
      return c.media;
  }
}
