import type { Folder } from "../core/types";
import type { PickerAnchor } from "../ui/picker/FolderPicker";

export const PICKER_WIDTH = 260;
export const PICKER_HEIGHT = 240;
const GAP = 8;

export type PickerView = { postId: string; anchor: PickerAnchor; folders: Folder[]; selected: string[] };
export type CounterView = { sessionCount: number; total: number | null; warning: boolean };
export type BridgeState = { picker: PickerView | null; counter: CounterView | null };

export function createStore() {
  let state: BridgeState = { picker: null, counter: null };
  const listeners = new Set<() => void>();
  return {
    get: (): BridgeState => state,
    set(update: (s: BridgeState) => BridgeState): void {
      state = update(state);
      for (const l of listeners) l();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type BridgeStore = ReturnType<typeof createStore>;

/** ブクマボタンの位置から、メニューを出す位置を決める（画面からはみ出さない） */
export function anchorFromRect(
  rect: { top: number; bottom: number; left: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  const below = rect.bottom + GAP;
  const top = below + PICKER_HEIGHT <= viewport.height ? below : Math.max(GAP, rect.top - GAP - PICKER_HEIGHT);
  const left = Math.min(Math.max(GAP, rect.left - PICKER_WIDTH / 2), viewport.width - PICKER_WIDTH - GAP);
  return { top, left };
}
