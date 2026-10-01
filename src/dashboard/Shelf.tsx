import { useMemo, useState } from "react";
import { selectPosts, SORT_KEYS, viewCounts, type SortKey, type View } from "../core/views";
import { addToFolder, removeFromFolder, setHidden } from "../db/posts";
import { t } from "../i18n";
import { AiStatus } from "./AiStatus";
import { BulkBar } from "./BulkBar";
import { useFolders, usePosts } from "./data";
import { useDb } from "./db-context";
import { useRun } from "./errors";
import { SORT_LABEL } from "./labels";
import { PostCard } from "./PostCard";
import { ReviewStrip } from "./ReviewStrip";
import { Sidebar } from "./Sidebar";

export const SHELF_PAGE_SIZE = 100;
const FIELD = "rounded-lg border border-amber-300 bg-white px-3 py-1.5 dark:border-stone-600 dark:bg-stone-800";

/** 「本棚」タブ */
export function Shelf() {
  const db = useDb();
  const run = useRun();
  const posts = usePosts();
  const folders = useFolders();
  const [view, setView] = useState<View>({ kind: "all" });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("bookmark-desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(SHELF_PAGE_SIZE);

  const list = useMemo(() => selectPosts(posts ?? [], { view, query, sort }), [posts, view, query, sort]);
  const visibleIds = useMemo(() => new Set(list.map((p) => p.id)), [list]);
  const counts = useMemo(() => viewCounts(posts ?? []), [posts]);
  const postMap = useMemo(() => new Map((posts ?? []).map((p) => [p.id, p])), [posts]);
  const folderMap = useMemo(() => new Map((folders ?? []).map((f) => [f.id, f])), [folders]);

  if (!posts || !folders) return null;

  const changeView = (v: View) => {
    setView(v);
    setSelected(new Set());
    setLimit(SHELF_PAGE_SIZE);
  };
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const ids = [...selected].filter((id) => visibleIds.has(id)); // 一覧から消えた投稿は操作しない

  return (
    <div className="flex gap-6">
      <Sidebar view={view} onChange={changeView} counts={counts} folders={folders} />
      <main className="min-w-0 flex-1 space-y-4">
        <ReviewStrip posts={postMap} folders={folders} />
        <AiStatus />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(SHELF_PAGE_SIZE);
            }}
            placeholder={t("shelf.search")}
            aria-label={t("shelf.search")}
            className={`${FIELD} min-w-48 flex-1`}
          />
          <select aria-label={t("shelf.sort")} value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={FIELD}>
            {SORT_KEYS.map((k) => (
              <option key={k} value={k}>
                {t(SORT_LABEL[k])}
              </option>
            ))}
          </select>
          <span className="text-sm text-stone-500">{t("shelf.count", { count: list.length })}</span>
        </div>
        {ids.length > 0 && (
          <BulkBar
            count={ids.length}
            folders={folders}
            hiddenView={view.kind === "hidden"}
            onAdd={(folderId) => void run(() => addToFolder(db, ids, folderId))}
            onRemove={(folderId) => void run(() => removeFromFolder(db, ids, folderId))}
            onToggleHidden={() =>
              void run(async () => {
                await setHidden(db, ids, view.kind !== "hidden");
                setSelected(new Set());
              })
            }
            onClear={() => setSelected(new Set())}
          />
        )}
        <ul aria-label={t("shelf.list")} className="space-y-3">
          {list.slice(0, limit).map((p) => (
            <li key={p.id}>
              <PostCard post={p} folders={folderMap} selected={selected.has(p.id)} onSelect={(on) => toggle(p.id, on)} />
            </li>
          ))}
        </ul>
        {list.length === 0 && <p className="rounded-xl bg-white p-6 text-stone-600 dark:bg-stone-800 dark:text-stone-300">{t("shelf.empty")}</p>}
        {list.length > limit && (
          <button type="button" className="w-full rounded-xl bg-amber-100 py-2 hover:bg-amber-200 dark:bg-stone-800 dark:hover:bg-stone-700" onClick={() => setLimit((l) => l + SHELF_PAGE_SIZE)}>
            {t("shelf.more", { count: list.length - limit })}
          </button>
        )}
      </main>
    </div>
  );
}
