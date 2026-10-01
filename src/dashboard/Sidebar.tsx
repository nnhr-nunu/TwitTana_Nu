import type { Folder } from "../core/types";
import { viewKey, type View, type ViewCounts } from "../core/views";
import { t } from "../i18n";

type Props = { view: View; onChange(v: View): void; counts: ViewCounts; folders: Folder[] };

/** 左の絞り込み一覧 */
export function Sidebar({ view, onChange, counts, folders }: Props) {
  const item = (v: View, label: string, count: number) => {
    const active = viewKey(v) === viewKey(view);
    return (
      <li key={viewKey(v)}>
        <button
          type="button"
          aria-current={active ? "true" : undefined}
          onClick={() => onChange(v)}
          className={`flex w-full justify-between gap-2 rounded-lg px-3 py-1.5 text-left ${
            active ? "bg-amber-200 font-bold dark:bg-stone-700" : "hover:bg-amber-100 dark:hover:bg-stone-800"
          }`}
        >
          <span className="truncate">{label}</span>
          <span className="text-stone-500">{count}</span>
        </button>
      </li>
    );
  };
  return (
    <nav aria-label={t("view.nav")} className="w-56 shrink-0 space-y-4">
      <ul className="space-y-1">
        {item({ kind: "all" }, t("view.all"), counts.all)}
        {item({ kind: "unsorted" }, t("view.unsorted"), counts.unsorted)}
        {item({ kind: "ai" }, t("view.ai"), counts.ai)}
        {item({ kind: "removed" }, t("view.removed"), counts.removed)}
      </ul>
      <div>
        <h2 className="px-3 text-xs font-bold text-stone-500">{t("view.folders")}</h2>
        <ul className="mt-1 space-y-1">{folders.map((f) => item({ kind: "folder", folderId: f.id }, f.name, counts.folders[f.id] ?? 0))}</ul>
      </div>
      <ul>{item({ kind: "hidden" }, t("view.hidden"), counts.hidden)}</ul>
    </nav>
  );
}
