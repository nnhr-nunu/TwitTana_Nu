import { TwitTanaDB } from "../db/schema";

/** テストごとに名前の違う DB を開く（fake-indexeddb 上） */
export function openTestDb(): TwitTanaDB {
  return new TwitTanaDB(`test-${crypto.randomUUID()}`);
}
