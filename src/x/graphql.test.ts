import { describe, expect, it } from "vitest";
import { bookmarkMutation, graphqlOperation, isBookmarkListOp, snowflakeToIso, tweetIdFromBody } from "./graphql";

describe("graphqlOperation", () => {
  it("絶対・相対どちらの URL からも操作名を取り出す", () => {
    expect(graphqlOperation("https://x.com/i/api/graphql/AbC-12_x/Bookmarks?variables=%7B%7D")).toBe("Bookmarks");
    expect(graphqlOperation("/i/api/graphql/q1/CreateBookmark")).toBe("CreateBookmark");
  });
  it("GraphQL 以外は null", () => {
    expect(graphqlOperation("https://x.com/home")).toBeNull();
    expect(graphqlOperation("https://abs.twimg.com/x.js")).toBeNull();
  });
});

describe("isBookmarkListOp", () => {
  it("ブクマ一覧の操作だけ true", () => {
    expect(isBookmarkListOp("Bookmarks")).toBe(true);
    expect(isBookmarkListOp("BookmarkSearchTimeline")).toBe(true);
    expect(isBookmarkListOp("BookmarkFolderTimeline")).toBe(true);
    expect(isBookmarkListOp("BookmarkFoldersSlice")).toBe(false);
    expect(isBookmarkListOp("HomeTimeline")).toBe(false);
    expect(isBookmarkListOp("CreateBookmark")).toBe(false);
  });
});

describe("bookmarkMutation", () => {
  it("追加と解除を見分ける", () => {
    expect(bookmarkMutation("CreateBookmark")).toBe("add");
    expect(bookmarkMutation("DeleteBookmark")).toBe("remove");
    expect(bookmarkMutation("FavoriteTweet")).toBeNull();
  });
});

describe("tweetIdFromBody", () => {
  it("文字列でもオブジェクトでも投稿 ID を取り出す", () => {
    expect(tweetIdFromBody('{"variables":{"tweet_id":"1973000000000000000"},"queryId":"q"}')).toBe("1973000000000000000");
    expect(tweetIdFromBody({ variables: { tweet_id: "123" } })).toBe("123");
  });
  it("取り出せなければ null", () => {
    expect(tweetIdFromBody("{壊れた")).toBeNull();
    expect(tweetIdFromBody({ variables: { tweet_id: 123 } })).toBeNull();
    expect(tweetIdFromBody({ variables: { tweet_id: "abc" } })).toBeNull();
    expect(tweetIdFromBody(undefined)).toBeNull();
  });
});

describe("snowflakeToIso", () => {
  it("投稿 ID から投稿日時を出す", () => {
    expect(snowflakeToIso("1973000000000000000")).toBe("2025-09-30T12:20:31.224Z");
  });
  it("古い形式の ID や数字でないものは null", () => {
    expect(snowflakeToIso("20")).toBeNull();
    expect(snowflakeToIso("abc")).toBeNull();
  });
});
