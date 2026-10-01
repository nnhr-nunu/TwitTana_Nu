import type { CapturedPost, MediaItem } from "../core/types";
import { snowflakeToIso } from "./graphql";

const BOOKMARK_BUTTON = '[data-testid="bookmark"], [data-testid="removeBookmark"]';

/** クリックされた要素がブクマボタン（またはその中）なら、ボタンを返す */
export function findBookmarkButton(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest(BOOKMARK_BUTTON) : null;
}

/** 投稿の枠（article）から、その投稿の ID を取る。日時のリンクを使うので引用元と取り違えない */
export function postIdFromArticle(article: Element): string | null {
  const href = article.querySelector('a[href*="/status/"] time')?.closest("a")?.getAttribute("href");
  return (href ? /\/status\/(\d+)/.exec(href)?.[1] : undefined) ?? null;
}

/** ID と URL しか分からない投稿（中身はあとでブクマ画面から埋まる） */
export function partialPost(postId: string): CapturedPost {
  return {
    id: postId,
    url: `https://x.com/i/status/${postId}`,
    text: "",
    author: { id: "", handle: "", name: "", avatarUrl: "" },
    postedAt: snowflakeToIso(postId) ?? "",
    media: [],
    links: [],
    hashtags: [],
    partial: true,
  };
}

/** 投稿の枠の中で、引用元（role="link" の箱）に入っていない要素だけ */
function ownElements(article: Element, selector: string): Element[] {
  return [...article.querySelectorAll(selector)].filter((el) => el.closest('[role="link"]') === null);
}

/**
 * 画面に出ている投稿の枠から、読める範囲で投稿を読む（通信データが無いときの予備）。
 * リンク・引用・投稿者 ID が欠けるので partial とし、通信データが来たら上書きされる
 */
export function readPostFromArticle(article: Element, postId: string): CapturedPost {
  const handle = article.querySelector(`a[href*="/status/${postId}"]`)?.getAttribute("href")?.split("/")[1] ?? "";
  if (!handle || handle === "i") return partialPost(postId);
  const textEl = ownElements(article, '[data-testid="tweetText"]')[0];
  const time = article.querySelector("time")?.getAttribute("datetime");
  const postedAt = time && !Number.isNaN(Date.parse(time)) ? new Date(time).toISOString() : (snowflakeToIso(postId) ?? "");
  const hashtags = [...(textEl?.querySelectorAll('a[href^="/hashtag/"]') ?? [])]
    .map((a) => (a.textContent ?? "").replace(/^[#＃]/, ""))
    .filter((h) => h !== "");
  const media: MediaItem[] = ownElements(article, 'img[src*="pbs.twimg.com/media/"]').map((img) => {
    const src = img.getAttribute("src") ?? "";
    return { type: "photo", url: src, thumbUrl: src };
  });
  return {
    id: postId,
    url: `https://x.com/${handle}/status/${postId}`,
    text: (textEl?.textContent ?? "").trim(),
    author: {
      id: "",
      handle,
      name: article.querySelector('[data-testid="User-Name"] span')?.textContent?.trim() || handle,
      avatarUrl: article.querySelector('[data-testid="Tweet-User-Avatar"] img')?.getAttribute("src") ?? "",
    },
    postedAt,
    media,
    links: [],
    hashtags,
    partial: true,
  };
}
