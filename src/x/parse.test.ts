import { describe, expect, it } from "vitest";
import { extractPosts, tweetToCaptured } from "./parse";
import { bookmarksResponse, rawTweet, timelineResponse, tombstone, visibilityWrapped } from "./test-builders";

describe("tweetToCaptured", () => {
  it("本文の短縮 URL を元の URL に戻し、画像の URL は消し、&amp; などを戻す", () => {
    const p = tweetToCaptured(
      rawTweet({
        id: "1973000000000000000",
        handle: "alice",
        name: "アリス",
        text: "見て &amp; 読んで https://t.co/aaa https://t.co/img",
        urls: [{ url: "https://t.co/aaa", expanded: "https://www.youtube.com/watch?v=1" }],
        hashtags: ["推し活"],
        media: [{ type: "photo", url: "https://t.co/img", base: "https://pbs.twimg.com/media/P1.jpg" }],
      }),
    );
    expect(p).toEqual({
      id: "1973000000000000000",
      url: "https://x.com/alice/status/1973000000000000000",
      text: "見て & 読んで https://www.youtube.com/watch?v=1",
      author: { id: "u-alice", handle: "alice", name: "アリス", avatarUrl: "https://pbs.twimg.com/profile_images/alice.jpg" },
      postedAt: "2025-09-30T12:20:31.224Z",
      media: [{ type: "photo", url: "https://pbs.twimg.com/media/P1.jpg", thumbUrl: "https://pbs.twimg.com/media/P1.jpg?name=small" }],
      links: [{ url: "https://www.youtube.com/watch?v=1", domain: "youtube.com" }],
      hashtags: ["推し活"],
    });
  });

  it("古い形のユーザー情報も読める", () => {
    const p = tweetToCaptured(rawTweet({ id: "1973000000000000001", handle: "bob", name: "Bob", userLayout: "legacy" }));
    expect(p?.author).toEqual({ id: "u-bob", handle: "bob", name: "Bob", avatarUrl: "https://pbs.twimg.com/profile_images/bob.jpg" });
  });

  it("長文の投稿は note_tweet の本文を使う", () => {
    const p = tweetToCaptured(rawTweet({ id: "1973000000000000002", text: "途中まで…", note: "全文です" }));
    expect(p?.text).toBe("全文です");
  });

  it("動画は一番ビットレートの高い mp4 を URL にし、縮小画像は静止画", () => {
    const p = tweetToCaptured(
      rawTweet({
        id: "1973000000000000003",
        media: [
          {
            type: "video",
            url: "https://t.co/v",
            base: "https://pbs.twimg.com/ext_tw_video_thumb/V.jpg",
            variants: [
              { content_type: "application/x-mpegURL", url: "https://video.twimg.com/v.m3u8" },
              { bitrate: 256000, content_type: "video/mp4", url: "https://video.twimg.com/low.mp4" },
              { bitrate: 2176000, content_type: "video/mp4", url: "https://video.twimg.com/high.mp4" },
            ],
          },
          { type: "animated_gif", url: "https://t.co/g", base: "https://pbs.twimg.com/tweet_video_thumb/G.jpg", variants: [{ bitrate: 0, content_type: "video/mp4", url: "https://video.twimg.com/g.mp4" }] },
        ],
      }),
    );
    expect(p?.media).toEqual([
      { type: "video", url: "https://video.twimg.com/high.mp4", thumbUrl: "https://pbs.twimg.com/ext_tw_video_thumb/V.jpg" },
      { type: "gif", url: "https://video.twimg.com/g.mp4", thumbUrl: "https://pbs.twimg.com/tweet_video_thumb/G.jpg" },
    ]);
  });

  it("引用元は ID・投稿者・本文だけ持つ", () => {
    const quoted = rawTweet({ id: "1973000000000000010", handle: "carol", text: "元の投稿" });
    const p = tweetToCaptured(rawTweet({ id: "1973000000000000011", text: "引用します", quoted: visibilityWrapped(quoted) }));
    expect(p?.quoted).toEqual({ id: "1973000000000000010", authorHandle: "carol", text: "元の投稿" });
  });

  it("投稿 ID が古い形式なら created_at を使う", () => {
    const p = tweetToCaptured(rawTweet({ id: "20", createdAt: "Tue Mar 21 20:50:14 +0000 2006" }));
    expect(p?.postedAt).toBe("2006-03-21T20:50:14.000Z");
  });

  it("必要な項目が無ければ null", () => {
    expect(tweetToCaptured({ __typename: "Tweet", rest_id: "1" })).toBeNull();
    expect(tweetToCaptured("x")).toBeNull();
  });
});

describe("extractPosts（bookmarks）", () => {
  const a = rawTweet({ id: "1973000000000000100", text: "A" });
  const quoted = rawTweet({ id: "1973000000000000102", text: "引用元" });
  const b = visibilityWrapped(rawTweet({ id: "1973000000000000101", text: "B", quoted }));

  it("一覧の項目の投稿だけを、並び値つきで返す（引用元は返さない）", () => {
    const r = extractPosts(
      bookmarksResponse([
        { tweet: a, sortIndex: "1868000000000000002" },
        { tweet: b, sortIndex: "1868000000000000001" },
      ]),
      "bookmarks",
    );
    expect(r.skipped).toBe(0);
    expect(r.posts.map((p) => [p.id, p.bookmarkOrder])).toEqual([
      ["1973000000000000100", "1868000000000000002"],
      ["1973000000000000101", "1868000000000000001"],
    ]);
  });

  it("削除済み・閲覧不可の投稿は黙って飛ばす", () => {
    const r = extractPosts(bookmarksResponse([{ tweet: tombstone(), sortIndex: "5" }, { tweet: a, sortIndex: "4" }]), "bookmarks");
    expect(r).toMatchObject({ skipped: 0 });
    expect(r.posts.map((p) => p.id)).toEqual(["1973000000000000100"]);
  });

  it("読めない投稿は数える", () => {
    const r = extractPosts(bookmarksResponse([{ tweet: { __typename: "Tweet", rest_id: "1" }, sortIndex: "5" }]), "bookmarks");
    expect(r).toEqual({ posts: [], skipped: 1 });
  });
});

describe("extractPosts（cache）", () => {
  it("リポストの元投稿と引用元も返す。同じ投稿は 1 つにまとめる", () => {
    const original = rawTweet({ id: "1973000000000000200", handle: "dave", text: "元" });
    const repost = rawTweet({ id: "1973000000000000201", handle: "erin", text: "RT @dave: 元", retweeted: original });
    const quoting = rawTweet({ id: "1973000000000000202", text: "引用", quoted: original });
    const r = extractPosts(timelineResponse([repost, quoting]), "cache");
    expect(r.posts.map((p) => p.id).sort()).toEqual(["1973000000000000200", "1973000000000000201", "1973000000000000202"]);
    expect(r.posts.every((p) => p.bookmarkOrder === undefined)).toBe(true);
  });

  it("投稿の無い返事は空", () => {
    expect(extractPosts({ data: { user: { result: { legacy: {} } } } }, "cache")).toEqual({ posts: [], skipped: 0 });
    expect(extractPosts(null, "cache")).toEqual({ posts: [], skipped: 0 });
  });
});
