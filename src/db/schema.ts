import Dexie, { type EntityTable } from "dexie";
import type { Folder, Post, Rule } from "../core/types";

export type KvRow = { key: string; value: unknown };

export class TwitTanaDB extends Dexie {
  posts!: EntityTable<Post, "id">;
  folders!: EntityTable<Folder, "id">;
  rules!: EntityTable<Rule, "id">;
  kv!: EntityTable<KvRow, "key">;

  constructor(name = "twittana") {
    super(name);
    this.version(1).stores({
      posts: "id, capturedAt, postedAt",
      folders: "id, order",
      rules: "id, folderId",
      kv: "key",
    });
  }
}

let shared: TwitTanaDB | undefined;

/** 拡張全体で共有する DB */
export function getDb(): TwitTanaDB {
  shared ??= new TwitTanaDB();
  return shared;
}
