import { createContext, useContext } from "react";
import { getDb, type TwitTanaDB } from "../db/schema";

const DbContext = createContext<TwitTanaDB | null>(null);

/** テストで別の DB を使うための Provider。無ければ拡張全体で共有の DB を使う */
export const DbProvider = DbContext.Provider;

export function useDb(): TwitTanaDB {
  return useContext(DbContext) ?? getDb();
}
