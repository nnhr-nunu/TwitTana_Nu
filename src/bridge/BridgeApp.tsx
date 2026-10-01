import { useSyncExternalStore } from "react";
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
          ツイッ棚：このページで {state.counter.sessionCount} 件取り込み
          {state.counter.total !== null && `（全 ${state.counter.total} 件）`}
          {state.counter.warning && <span className="tt-counter__warn">X の仕様が変わったようです。更新をお待ちください</span>}
        </div>
      )}
    </>
  );
}
