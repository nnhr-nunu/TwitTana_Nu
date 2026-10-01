import type { ParseHealth } from "./types";

/** X の仕様変更で読み取れていないかもしれない（最後の失敗が最後の成功より新しい） */
export function hasParseWarning(h: ParseHealth): boolean {
  if (!h.lastErrorAt) return false;
  return !h.lastOkAt || h.lastErrorAt > h.lastOkAt;
}
