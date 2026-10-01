import { bookmarkMutation, isBookmarkListOp, tweetIdFromBody } from "./graphql";
import { HOOK_SOURCE, MAX_POSTS_PER_MESSAGE, type HookMessage } from "./messages";
import { extractPosts, type ExtractResult } from "./parse";
import { RecentPosts } from "./recent-cache";

export type HookCore = {
  /** GraphQL の返事（成功したもの）を受け取り、橋渡し係へ送るメッセージを返す */
  onResponse(op: string, json: unknown): HookMessage[];
  /** ブクマ操作（成功したもの）の送信本文を受け取り、送るメッセージを返す */
  onMutation(op: string, requestBody: unknown): HookMessage[];
};

export function createHookCore(cache: RecentPosts = new RecentPosts()): HookCore {
  return {
    onResponse(op, json) {
      if (bookmarkMutation(op)) return [];
      const bookmarkList = isBookmarkListOp(op);
      let result: ExtractResult;
      try {
        result = extractPosts(json, bookmarkList ? "bookmarks" : "cache");
      } catch {
        return [{ source: HOOK_SOURCE, type: "parse-error", op }];
      }
      cache.add(result.posts);
      const out: HookMessage[] = [];
      if (result.skipped > 0 && (bookmarkList || result.posts.length === 0)) {
        out.push({ source: HOOK_SOURCE, type: "parse-error", op });
      }
      if (bookmarkList) {
        for (let i = 0; i < result.posts.length; i += MAX_POSTS_PER_MESSAGE) {
          out.push({ source: HOOK_SOURCE, type: "bookmarks-seen", posts: result.posts.slice(i, i + MAX_POSTS_PER_MESSAGE) });
        }
      }
      return out;
    },

    onMutation(op, requestBody) {
      const kind = bookmarkMutation(op);
      if (!kind) return [];
      const postId = tweetIdFromBody(requestBody);
      if (!postId) return [{ source: HOOK_SOURCE, type: "parse-error", op }];
      if (kind === "remove") return [{ source: HOOK_SOURCE, type: "bookmark-removed", postId }];
      return [{ source: HOOK_SOURCE, type: "bookmark-added", postId, post: cache.get(postId) ?? null }];
    },
  };
}
