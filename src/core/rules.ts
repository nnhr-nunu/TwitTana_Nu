import { normalizeDomain, normalizeText } from "./normalize";
import type { CapturedPost, Condition, Post, Rule } from "./types";

function stripPrefix(value: string, prefix: RegExp): string {
  return normalizeText(value.trim()).replace(prefix, "");
}

export function matchesCondition(post: CapturedPost, c: Condition): boolean {
  switch (c.kind) {
    case "keyword": {
      const v = normalizeText(c.value.trim());
      return v !== "" && normalizeText(post.text).includes(v);
    }
    case "author": {
      const v = stripPrefix(c.handle, /^@/);
      return v !== "" && normalizeText(post.author.handle) === v;
    }
    case "hashtag": {
      const v = stripPrefix(c.tag, /^#/);
      return v !== "" && post.hashtags.some((h) => normalizeText(h) === v);
    }
    case "domain": {
      const v = normalizeDomain(c.domain);
      return (
        v !== "" &&
        post.links.some((l) => {
          const d = normalizeDomain(l.domain);
          return d === v || d.endsWith(`.${v}`);
        })
      );
    }
    case "hasMedia":
      if (c.media === "any") return post.media.length > 0;
      if (c.media === "photo") return post.media.some((m) => m.type === "photo");
      return post.media.some((m) => m.type === "video" || m.type === "gif");
  }
}

/** ルールの条件をすべて満たすか。無効なルール・条件なしのルールは当たらない */
export function matchesRule(post: CapturedPost, rule: Rule): boolean {
  return rule.enabled && rule.conditions.length > 0 && rule.conditions.every((c) => matchesCondition(post, c));
}

/** 当たったルールの入れ先フォルダ（ルールの順番どおり・重複なし） */
export function ruleFolderIds(post: CapturedPost, rules: Rule[]): string[] {
  const ids: string[] = [];
  for (const r of [...rules].sort((a, b) => a.order - b.order)) {
    if (matchesRule(post, r) && !ids.includes(r.folderId)) ids.push(r.folderId);
  }
  return ids;
}

/** ルールで当たったフォルダを足した投稿を返す。手で整理した投稿や、変化がなければ null */
export function withRuleFolders(post: Post, rules: Rule[]): Post | null {
  if (post.sortedByUser) return null;
  const add = ruleFolderIds(post, rules).filter((id) => !post.folders.some((f) => f.folderId === id));
  if (add.length === 0) return null;
  return { ...post, folders: [...post.folders, ...add.map((folderId) => ({ folderId, by: "rule" as const }))] };
}
