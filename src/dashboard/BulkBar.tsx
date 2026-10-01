import { useState } from "react";
import type { Folder } from "../core/types";
import { t } from "../i18n";

type Props = {
  count: number;
  folders: Folder[];
  hiddenView: boolean;
  onAdd(folderId: string): void;
  onRemove(folderId: string): void;
  onToggleHidden(): void;
  onClear(): void;
};

const BUTTON = "rounded-lg bg-amber-700 px-3 py-1 text-sm text-white disabled:opacity-40 dark:bg-amber-600";
const SUBTLE = "rounded-lg px-3 py-1 text-sm hover:bg-amber-100 dark:hover:bg-stone-600";

/** 選んだ投稿をまとめて操作する帯 */
export function BulkBar({ count, folders, hiddenView, onAdd, onRemove, onToggleHidden, onClear }: Props) {
  const [folderId, setFolderId] = useState("");
  return (
    <div role="toolbar" aria-label={t("bulk.selected", { count })} className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-xl bg-amber-200 p-2 dark:bg-stone-700">
      <span className="px-2 font-bold">{t("bulk.selected", { count })}</span>
      <select
        aria-label={t("bulk.chooseFolder")}
        value={folderId}
        onChange={(e) => setFolderId(e.target.value)}
        className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-sm dark:border-stone-600 dark:bg-stone-800"
      >
        <option value="">{t("bulk.chooseFolder")}</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <button type="button" className={BUTTON} disabled={!folderId} onClick={() => onAdd(folderId)}>
        {t("bulk.add")}
      </button>
      <button type="button" className={BUTTON} disabled={!folderId} onClick={() => onRemove(folderId)}>
        {t("bulk.remove")}
      </button>
      <button type="button" className={SUBTLE} onClick={onToggleHidden}>
        {t(hiddenView ? "bulk.unhide" : "bulk.hide")}
      </button>
      <button type="button" className={`${SUBTLE} ml-auto`} onClick={onClear}>
        {t("bulk.clear")}
      </button>
    </div>
  );
}
