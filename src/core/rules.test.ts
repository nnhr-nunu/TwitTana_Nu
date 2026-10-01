import { describe, expect, it } from "vitest";
import { makeCaptured, makePost } from "../test/factories";
import type { Rule } from "./types";
import { matchesCondition, matchesRule, ruleFolderIds, withRuleFolders } from "./rules";

function rule(over: Partial<Rule>): Rule {
  return { id: "r", folderId: "f", conditions: [], enabled: true, order: 0, ...over };
}

describe("matchesCondition", () => {
  it("キーワードは全角半角・大文字小文字を区別しない", () => {
    const post = makeCaptured({ text: "Unity の ﾁｭｰﾄﾘｱﾙ です" });
    expect(matchesCondition(post, { kind: "keyword", value: "ＵＮＩＴＹ" })).toBe(true);
    expect(matchesCondition(post, { kind: "keyword", value: "チュートリアル" })).toBe(true);
    expect(matchesCondition(post, { kind: "keyword", value: "Unreal" })).toBe(false);
  });
  it("空のキーワードは当てない", () => {
    expect(matchesCondition(makeCaptured(), { kind: "keyword", value: "  " })).toBe(false);
  });
  it("投稿者は @ の有無と大文字小文字を区別しない", () => {
    const post = makeCaptured({ author: { id: "u", handle: "NunuHara", name: "n", avatarUrl: "" } });
    expect(matchesCondition(post, { kind: "author", handle: "@nunuhara" })).toBe(true);
    expect(matchesCondition(post, { kind: "author", handle: "other" })).toBe(false);
  });
  it("ハッシュタグは # や ＃ の有無を区別しない", () => {
    const post = makeCaptured({ hashtags: ["推し活"] });
    expect(matchesCondition(post, { kind: "hashtag", tag: "＃推し活" })).toBe(true);
    expect(matchesCondition(post, { kind: "hashtag", tag: "推し" })).toBe(false);
  });
  it("ドメインはサブドメインにも当たる", () => {
    const post = makeCaptured({ links: [{ url: "https://m.youtube.com/watch?v=1", domain: "m.youtube.com" }] });
    expect(matchesCondition(post, { kind: "domain", domain: "youtube.com" })).toBe(true);
    expect(matchesCondition(post, { kind: "domain", domain: "https://www.youtube.com/" })).toBe(true);
    expect(matchesCondition(post, { kind: "domain", domain: "tube.com" })).toBe(false);
  });
  it("画像・動画あり", () => {
    const photo = makeCaptured({ media: [{ type: "photo", url: "u", thumbUrl: "t" }] });
    const gif = makeCaptured({ media: [{ type: "gif", url: "u", thumbUrl: "t" }] });
    expect(matchesCondition(photo, { kind: "hasMedia", media: "any" })).toBe(true);
    expect(matchesCondition(photo, { kind: "hasMedia", media: "video" })).toBe(false);
    expect(matchesCondition(gif, { kind: "hasMedia", media: "video" })).toBe(true);
    expect(matchesCondition(makeCaptured(), { kind: "hasMedia", media: "any" })).toBe(false);
  });
});

describe("matchesRule", () => {
  const post = makeCaptured({ text: "Unity 講座", hashtags: ["gamedev"] });
  it("条件をすべて満たせば当たる", () => {
    expect(matchesRule(post, rule({ conditions: [{ kind: "keyword", value: "unity" }, { kind: "hashtag", tag: "gamedev" }] }))).toBe(true);
    expect(matchesRule(post, rule({ conditions: [{ kind: "keyword", value: "unity" }, { kind: "hashtag", tag: "art" }] }))).toBe(false);
  });
  it("無効なルールと条件なしのルールは当たらない", () => {
    expect(matchesRule(post, rule({ enabled: false, conditions: [{ kind: "keyword", value: "unity" }] }))).toBe(false);
    expect(matchesRule(post, rule({ conditions: [] }))).toBe(false);
  });
});

describe("ruleFolderIds", () => {
  it("当たったルールのフォルダを順番どおり重複なしで返す", () => {
    const post = makeCaptured({ text: "Unity 講座" });
    const rules = [
      rule({ id: "2", folderId: "b", order: 2, conditions: [{ kind: "keyword", value: "講座" }] }),
      rule({ id: "1", folderId: "a", order: 1, conditions: [{ kind: "keyword", value: "unity" }] }),
      rule({ id: "3", folderId: "a", order: 3, conditions: [{ kind: "keyword", value: "講座" }] }),
    ];
    expect(ruleFolderIds(post, rules)).toEqual(["a", "b"]);
  });
});

describe("withRuleFolders", () => {
  const rules = [rule({ folderId: "a", conditions: [{ kind: "keyword", value: "unity" }] })];
  it("当たったフォルダを by: rule で足す", () => {
    const p = withRuleFolders(makePost({ text: "unity" }), rules);
    expect(p?.folders).toEqual([{ folderId: "a", by: "rule" }]);
  });
  it("利用者が手で整理した投稿には手を出さない", () => {
    expect(withRuleFolders(makePost({ text: "unity", sortedByUser: true }), rules)).toBeNull();
  });
  it("既に入っていれば変えない", () => {
    expect(withRuleFolders(makePost({ text: "unity", folders: [{ folderId: "a", by: "ai" }] }), rules)).toBeNull();
  });
  it("当たらなければ null", () => {
    expect(withRuleFolders(makePost({ text: "ほか" }), rules)).toBeNull();
  });
});
