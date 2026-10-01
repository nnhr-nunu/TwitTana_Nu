import type { CapturedPost, Post } from "../core/types";

export function makeCaptured(over: Partial<CapturedPost> = {}): CapturedPost {
  const id = over.id ?? "1000";
  return {
    id,
    url: `https://x.com/someone/status/${id}`,
    text: "テスト投稿",
    author: { id: "u1", handle: "someone", name: "だれか", avatarUrl: "https://pbs.twimg.com/profile_images/a.jpg" },
    postedAt: "2026-01-01T00:00:00.000Z",
    media: [],
    links: [],
    hashtags: [],
    ...over,
  };
}

export function makePost(over: Partial<Post> = {}): Post {
  return {
    ...makeCaptured(over),
    capturedAt: "2026-02-01T00:00:00.000Z",
    folders: [],
    sortedByUser: false,
    removedOnX: false,
    hidden: false,
    review: { count: 0 },
    ...over,
  };
}
