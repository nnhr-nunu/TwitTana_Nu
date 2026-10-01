import { useSyncExternalStore } from "react";
import { t } from "../i18n";
import { FolderPicker, type CreateFolderError } from "../ui/picker/FolderPicker";
import type { BridgeStore } from "./store";

export type BridgeActions = {
  toggle(folderId: string, on: boolean): void;
  create(name: string): Promise<CreateFolderError | null>;
  closePicker(): void;
};

/** x.com の上に重ねる画面（フォルダ選択メニューと、ブクマ画面の取り込み件数） */
export function BridgeApp({ store, actions }: { store: BridgeStore; actions: BridgeActions }) {
  const state = useSyncExternalStore(store.subscribe, store.get);
  return (
    <>
      {state.picker && (
        <FolderPicker
          key={state.picker.postId}
          folders={state.picker.folders}
          selected={state.picker.selected}
          anchor={state.picker.anchor}
          onToggle={actions.toggle}
          onCreate={actions.create}
          onClose={actions.closePicker}
        />
      )}
      {state.counter && !state.picker && (
        <div className="tt-counter" role="status">
          {t("counter.text", { count: state.counter.sessionCount })}
          {state.counter.total !== null && t("counter.total", { total: state.counter.total })}
          {state.counter.warning && <span className="tt-counter__warn">{t("counter.warning")}</span>}
        </div>
      )}
    </>
  );
}
