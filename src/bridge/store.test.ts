import { describe, expect, it, vi } from "vitest";
import { anchorFromRect, createStore, PICKER_HEIGHT, PICKER_WIDTH, withPickerSelection } from "./store";

describe("createStore", () => {
  it("更新すると購読者に知らせる。解除後は知らせない", () => {
    const store = createStore();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.set((s) => ({ ...s, counter: { sessionCount: 1, total: 10, warning: false } }));
    expect(store.get().counter?.total).toBe(10);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    store.set((s) => ({ ...s, counter: null }));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("anchorFromRect", () => {
  const viewport = { width: 1200, height: 800 };
  it("ボタンの下に、ボタンの中心に寄せて出す", () => {
    expect(anchorFromRect({ top: 100, bottom: 130, left: 500 }, viewport)).toEqual({ top: 138, left: 500 - PICKER_WIDTH / 2 });
  });
  it("下に入りきらなければ上に出す", () => {
    expect(anchorFromRect({ top: 700, bottom: 730, left: 500 }, viewport)).toEqual({ top: 700 - 8 - PICKER_HEIGHT, left: 370 });
  });
  it("画面の左右の端からはみ出さない", () => {
    expect(anchorFromRect({ top: 100, bottom: 130, left: 10 }, viewport).left).toBe(8);
    expect(anchorFromRect({ top: 100, bottom: 130, left: 1190 }, viewport).left).toBe(1200 - PICKER_WIDTH - 8);
  });
});

describe("withPickerSelection", () => {
  const state = { picker: { postId: "B", anchor: null, folders: [], selected: ["x"] }, counter: null };
  it("今開いているメニューの投稿のときだけ反映する", () => {
    expect(withPickerSelection(state, "B", ["y"]).picker?.selected).toEqual(["y"]);
    expect(withPickerSelection(state, "A", ["y"])).toBe(state);
    expect(withPickerSelection({ picker: null, counter: null }, "B", ["y"]).picker).toBeNull();
  });
});
