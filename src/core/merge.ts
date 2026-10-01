import type { CapturedPost, FolderAssignment, Post } from "./types";

/** 投稿の「中身」だけを取り出す（id と並び値と整理の状態は含めない） */
function contentOf(p: CapturedPost) {
  return {
    url: p.url,
    text: p.text,
    author: p.author,
    postedAt: p.postedAt,
    media: p.media,
    links: p.links,
    hashtags: p.hashtags,
    quoted: p.quoted,
    partial: p.partial,
  };
}

/** X から取り込んだ投稿を、既にある投稿に合流する。整理の状態は残す */
export function mergeCaptured(
  existing: Post | undefined,
  incoming: CapturedPost,
  opts: { now: string; bookmarked: boolean },
): Post {
  if (!existing) {
    return {
      ...incoming,
      capturedAt: opts.now,
      folders: [],
      sortedByUser: false,
      removedOnX: false,
      hidden: false,
      review: { count: 0 },
    };
  }
  const source = incoming.partial && !existing.partial ? existing : incoming;
  return {
    ...existing,
    ...contentOf(source),
    bookmarkOrder: incoming.bookmarkOrder ?? existing.bookmarkOrder,
    removedOnX: opts.bookmarked ? false : existing.removedOnX,
  };
}

function laterOf(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/** 書き出しファイルから読み込んだ投稿を、既にある投稿に合流する */
export function mergeImported(existing: Post | undefined, imported: Post): Post {
  if (!existing) return imported;
  const folders: FolderAssignment[] = [...existing.folders];
  for (const f of imported.folders) {
    if (!folders.some((e) => e.folderId === f.folderId)) folders.push(f);
  }
  const source = existing.partial && !imported.partial ? imported : existing;
  return {
    ...existing,
    ...contentOf(source),
    bookmarkOrder: existing.bookmarkOrder ?? imported.bookmarkOrder,
    capturedAt: existing.capturedAt < imported.capturedAt ? existing.capturedAt : imported.capturedAt,
    folders,
    sortedByUser: existing.sortedByUser || imported.sortedByUser,
    hidden: existing.hidden || imported.hidden,
    review: {
      count: Math.max(existing.review.count, imported.review.count),
      lastAt: laterOf(existing.review.lastAt, imported.review.lastAt),
    },
  };
}
