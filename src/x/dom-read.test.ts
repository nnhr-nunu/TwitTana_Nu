// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { findBookmarkButton, partialPost, postIdFromArticle, readPostFromArticle } from "./dom-read";

const ID = "1973000000000000400";

function article(index: number): Element {
  const found = document.querySelectorAll("article")[index];
  if (!found) throw new Error(`article ${index} が無い`);
  return found;
}

beforeEach(() => {
  document.body.innerHTML = `
    <article data-testid="tweet">
      <div data-testid="Tweet-User-Avatar"><img src="https://pbs.twimg.com/profile_images/a.jpg"></div>
      <div data-testid="User-Name"><a href="/alice"><span>アリス</span></a><a href="/alice/status/${ID}"><time datetime="2026-09-01T10:00:00.000Z">9月1日</time></a></div>
      <div data-testid="tweetText"><span>すごい</span> <a href="/hashtag/推し活">#推し活</a></div>
      <img src="https://pbs.twimg.com/media/P1?format=jpg&name=small">
      <div role="group"><button data-testid="bookmark"><svg><path></path></svg></button></div>
      <div role="link"><a href="/carol/status/1973000000000000399"><time datetime="2026-08-01T00:00:00.000Z">8月1日</time></a><div data-testid="tweetText">引用元の本文</div><img src="https://pbs.twimg.com/media/Q1?format=jpg&name=small"></div>
    </article>
    <article data-testid="tweet"><div>ID の分からない投稿</div></article>`;
});

describe("findBookmarkButton", () => {
  it("ブクマボタンの中の要素からボタンを見つける", () => {
    const path = document.querySelector("path");
    expect(findBookmarkButton(path)?.getAttribute("data-testid")).toBe("bookmark");
    expect(findBookmarkButton(document.querySelector("time"))).toBeNull();
    expect(findBookmarkButton(null)).toBeNull();
  });
});

describe("postIdFromArticle", () => {
  it("日時のリンクから投稿 ID を取る（引用元の ID ではなく）", () => {
    expect(postIdFromArticle(article(0))).toBe(ID);
    expect(postIdFromArticle(article(1))).toBeNull();
  });
});

describe("readPostFromArticle", () => {
  it("画面に出ている範囲で投稿を読む", () => {
    expect(readPostFromArticle(article(0), ID)).toEqual({
      id: ID,
      url: `https://x.com/alice/status/${ID}`,
      text: "すごい #推し活",
      author: { id: "", handle: "alice", name: "アリス", avatarUrl: "https://pbs.twimg.com/profile_images/a.jpg" },
      postedAt: "2026-09-01T10:00:00.000Z",
      media: [{ type: "photo", url: "https://pbs.twimg.com/media/P1?format=jpg&name=small", thumbUrl: "https://pbs.twimg.com/media/P1?format=jpg&name=small" }],
      links: [],
      hashtags: ["推し活"],
      partial: true,
    });
  });
  it("本文の無い投稿で、引用元の本文や画像を自分のものとして取らない", () => {
    document.body.innerHTML = `<article><a href="/alice/status/${ID}"><time datetime="2026-09-01T10:00:00.000Z">x</time></a>
      <div role="link"><div data-testid="tweetText">引用元の本文</div><img src="https://pbs.twimg.com/media/Q1"></div></article>`;
    const p = readPostFromArticle(article(0), ID);
    expect(p.text).toBe("");
    expect(p.media).toEqual([]);
  });
  it("読めなければ ID と URL だけの投稿にする", () => {
    expect(readPostFromArticle(article(1), ID)).toEqual(partialPost(ID));
  });
});

describe("partialPost", () => {
  it("ID と URL と、ID から分かる投稿日時だけ", () => {
    expect(partialPost(ID)).toEqual({
      id: ID,
      url: `https://x.com/i/status/${ID}`,
      text: "",
      author: { id: "", handle: "", name: "", avatarUrl: "" },
      postedAt: "2025-09-30T12:20:31.224Z",
      media: [],
      links: [],
      hashtags: [],
      partial: true,
    });
  });
});
