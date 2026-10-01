import { useLiveQuery } from "dexie-react-hooks";
import type { Folder, Post, Rule, Settings } from "../core/types";
import { listFolders } from "../db/folders";
import { listRules } from "../db/rules-repo";
import { getSettings } from "../db/settings";
import { useDb } from "./db-context";

/** DB を見張り、変わったら最新の中身を返す（読み込み中は undefined） */
export function usePosts(): Post[] | undefined {
  const db = useDb();
  return useLiveQuery(() => db.posts.toArray(), [db]);
}

export function useFolders(): Folder[] | undefined {
  const db = useDb();
  return useLiveQuery(() => listFolders(db), [db]);
}

export function useRules(): Rule[] | undefined {
  const db = useDb();
  return useLiveQuery(() => listRules(db), [db]);
}

export function useSettings(): Settings | undefined {
  const db = useDb();
  return useLiveQuery(() => getSettings(db), [db]);
}

export function usePostCount(): number | undefined {
  const db = useDb();
  return useLiveQuery(() => db.posts.count(), [db]);
}
