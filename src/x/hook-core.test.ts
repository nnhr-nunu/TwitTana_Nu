import { describe, expect, it } from "vitest";
import { createHookCore } from "./hook-core";
import { HOOK_SOURCE } from "./messages";
import { bookmarksResponse, rawTweet, timelineResponse } from "./test-builders";

const ID = "1973000000000000300";
const body = (id: string) => JSON.stringify({ variables: { tweet_id: id }, queryId: "q" });

describe("createHookCore", () => {
  it("ブクマ一覧の返事は bookmarks-seen にする", () => {
    const core = createHookCore();
    const msgs = core.onResponse("Bookmarks", bookmarksResponse([{ tweet: rawTweet({ id: ID }), sortIndex: "9" }]));
    expect(msgs).toMatchObject([{ source: HOOK_SOURCE, type: "bookmarks-seen", posts: [{ id: ID, bookmarkOrder: "9" }] }]);
    expect(msgs).toHaveLength(1);
  });

  it("タイムラインの返事は覚えるだけで、ブクマしたときに中身つきで知らせる", () => {
    const core = createHookCore();
    expect(core.onResponse("HomeTimeline", timelineResponse([rawTweet({ id: ID, text: "覚えた" })]))).toEqual([]);
    expect(core.onMutation("CreateBookmark", body(ID))).toMatchObject([
      { source: HOOK_SOURCE, type: "bookmark-added", postId: ID, post: { id: ID, text: "覚えた" } },
    ]);
  });

  it("覚えていない投稿のブクマは post: null で知らせる", () => {
    expect(createHookCore().onMutation("CreateBookmark", body(ID))).toEqual([{ source: HOOK_SOURCE, type: "bookmark-added", postId: ID, post: null }]);
  });

  it("ブクマ解除を知らせる", () => {
    expect(createHookCore().onMutation("DeleteBookmark", body(ID))).toEqual([{ source: HOOK_SOURCE, type: "bookmark-removed", postId: ID }]);
  });

  it("ブクマ以外の操作は何もしない", () => {
    expect(createHookCore().onMutation("FavoriteTweet", body(ID))).toEqual([]);
  });

  it("送信本文から投稿 ID が読めなければ parse-error", () => {
    expect(createHookCore().onMutation("CreateBookmark", "{}")).toEqual([{ source: HOOK_SOURCE, type: "parse-error", op: "CreateBookmark" }]);
  });

  it("ブクマ一覧で読めない投稿があれば parse-error も出す", () => {
    const msgs = createHookCore().onResponse("Bookmarks", bookmarksResponse([{ tweet: { __typename: "Tweet", rest_id: "1" }, sortIndex: "9" }]));
    expect(msgs).toEqual([{ source: HOOK_SOURCE, type: "parse-error", op: "Bookmarks" }]);
  });

  it("件数が多ければ分けて送る", () => {
    const entries = Array.from({ length: 501 }, (_, i) => ({ tweet: rawTweet({ id: String(1973000000000000000n + BigInt(i)) }), sortIndex: String(i + 1) }));
    const msgs = createHookCore().onResponse("Bookmarks", bookmarksResponse(entries));
    expect(msgs.map((m) => (m.type === "bookmarks-seen" ? m.posts.length : 0))).toEqual([500, 1]);
  });

  it("一部だけ読めなかったら、保存のあとに parse-error を出す（警告が成功で上書きされないように）", () => {
    const msgs = createHookCore().onResponse(
      "Bookmarks",
      bookmarksResponse([
        { tweet: rawTweet({ id: ID }), sortIndex: "9" },
        { tweet: { __typename: "Tweet", rest_id: "1" }, sortIndex: "8" },
      ]),
    );
    expect(msgs.map((m) => m.type)).toEqual(["bookmarks-seen", "parse-error"]);
  });
});
