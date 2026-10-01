import { useEffect, useState, type FormEvent } from "react";
import { moveItem } from "../core/move";
import type { Folder } from "../core/types";
import { createFolder, deleteFolder, FolderNameError, reorderFolders, updateFolder } from "../db/folders";
import { t } from "../i18n";
import { useFolders } from "./data";
import { useDb } from "./db-context";
import { useRun } from "./errors";
import { FOLDER_ERROR_LABEL } from "./labels";

const FIELD = "rounded-lg border border-amber-300 bg-white px-3 py-1.5 dark:border-stone-600 dark:bg-stone-900";
const BUTTON = "rounded-lg bg-amber-700 px-3 py-1.5 text-white dark:bg-amber-600";
const SUBTLE = "rounded-lg px-2 py-1 hover:bg-amber-100 disabled:opacity-30 dark:hover:bg-stone-700";

function FolderRow({ folder, index, total, onMove }: { folder: Folder; index: number; total: number; onMove(delta: number): void }) {
  const db = useDb();
  const run = useRun();
  const [name, setName] = useState(folder.name);
  const [description, setDescription] = useState(folder.description);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(folder.name);
    setDescription(folder.description);
  }, [folder.name, folder.description]);

  const save = () => {
    if (name === folder.name && description === folder.description) return;
    void run(async () => {
      try {
        await updateFolder(db, folder.id, { name, description });
        setError(null);
      } catch (e) {
        if (!(e instanceof FolderNameError)) throw e;
        setError(t(FOLDER_ERROR_LABEL[e.code]));
        setName(folder.name);
      }
    });
  };

  const remove = () => {
    if (!window.confirm(t("folders.confirmDelete", { name: folder.name }))) return;
    void run(() => deleteFolder(db, folder.id));
  };

  return (
    <li className="space-y-2 rounded-xl border border-amber-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-800">
      <div className="flex items-center gap-2">
        <input
          aria-label={t("folders.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          className={`${FIELD} min-w-0 flex-1`}
        />
        <button type="button" className={SUBTLE} aria-label={t("folders.up")} disabled={index === 0} onClick={() => onMove(-1)}>
          ↑
        </button>
        <button type="button" className={SUBTLE} aria-label={t("folders.down")} disabled={index === total - 1} onClick={() => onMove(1)}>
          ↓
        </button>
        <button type="button" className={SUBTLE} onClick={remove}>
          {t("folders.delete")}
        </button>
      </div>
      <input
        aria-label={t("folders.description")}
        placeholder={t("folders.description")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={save}
        className={`${FIELD} w-full text-sm`}
      />
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </li>
  );
}

/** フォルダの作成・名前と説明の変更・並べ替え・削除 */
export function FolderEditor() {
  const db = useDb();
  const run = useRun();
  const folders = useFolders();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!folders) return null;

  const create = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      try {
        await createFolder(db, { name }, new Date().toISOString());
        setName("");
        setError(null);
      } catch (err) {
        if (!(err instanceof FolderNameError)) throw err;
        setError(t(FOLDER_ERROR_LABEL[err.code]));
      }
    });
  };

  const move = (index: number, delta: number) =>
    void run(() => reorderFolders(db, moveItem(folders.map((f) => f.id), index, index + delta)));

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{t("folders.title")}</h2>
      <form onSubmit={create} className="flex gap-2">
        <input
          aria-label={t("folders.new")}
          placeholder={t("folders.new")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${FIELD} min-w-0 flex-1`}
        />
        <button type="submit" className={BUTTON}>
          {t("folders.add")}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {folders.length === 0 ? (
        <p className="text-stone-500">{t("folders.none")}</p>
      ) : (
        <ul className="space-y-2">
          {folders.map((f, i) => (
            <FolderRow key={f.id} folder={f} index={i} total={folders.length} onMove={(delta) => move(i, delta)} />
          ))}
        </ul>
      )}
    </section>
  );
}
