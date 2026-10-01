import { t } from "../i18n";
import { useFolders } from "./data";
import { useAiSorter } from "./useAiSorter";

/** 本棚タブの AI の状態とボタン（AI が使えてオンのときだけ出す） */
export function AiStatus() {
  const folders = useFolders();
  const { state, waiting, start, usable } = useAiSorter();
  if (!usable || !folders) return null;
  if (folders.length === 0) return <p className="text-sm text-stone-500">{t("ai.needFolders")}</p>;
  const text =
    state.status === "running"
      ? t("ai.running", { done: state.done, sorted: state.sorted })
      : state.status === "stopped"
        ? t("ai.stopped")
        : state.status === "finished"
          ? t("ai.finished", { done: state.done, sorted: state.sorted })
          : t("ai.waiting", { count: waiting ?? 0 });
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-2 text-sm dark:bg-stone-800">
      <span>{text}</span>
      {state.status !== "running" && (waiting ?? 0) > 0 && (
        <button type="button" className="rounded-lg bg-amber-700 px-3 py-1 text-white dark:bg-amber-600" onClick={start}>
          {t("ai.run")}
        </button>
      )}
    </div>
  );
}
