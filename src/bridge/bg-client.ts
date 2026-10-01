import { browser } from "#imports";
import type { BgRequest, BgResponseMap } from "../background/protocol";
import type { CapturedPost } from "../core/types";

const RETRIES = 3;
const RETRY_WAIT_MS = 300;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 裏方へ依頼する。眠っていて返事が無いときは少し待って最大 3 回まで送り直す */
export async function sendToBackground<K extends BgRequest["type"]>(
  req: Extract<BgRequest, { type: K }>,
): Promise<BgResponseMap[K]> {
  let lastError: unknown;
  for (let i = 0; i < RETRIES; i++) {
    try {
      const res: unknown = await browser.runtime.sendMessage(req);
      if (typeof res === "object" && res !== null && "error" in res) throw new Error(String((res as { error: unknown }).error));
      return res as BgResponseMap[K];
    } catch (e) {
      lastError = e;
      await wait(RETRY_WAIT_MS * (i + 1));
    }
  }
  throw lastError;
}

const pending: CapturedPost[] = [];

/** 投稿を保存させる。失敗したらページ内にためて、次に保存するときに一緒に送る */
export async function savePostsQueued(posts: CapturedPost[]): Promise<BgResponseMap["save-posts"] | null> {
  const batch = [...pending.splice(0), ...posts];
  try {
    return await sendToBackground<"save-posts">({ type: "save-posts", posts: batch });
  } catch {
    pending.push(...batch);
    return null;
  }
}
