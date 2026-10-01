// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Folder } from "../../core/types";
import { FolderPicker, PICKER_AUTO_CLOSE_MS, type FolderPickerProps } from "./FolderPicker";

const folders: Folder[] = [
  { id: "a", name: "ゲーム", description: "", order: 0, createdAt: "" },
  { id: "b", name: "料理", description: "", order: 1, createdAt: "" },
];

function setup(over: Partial<Pick<FolderPickerProps, "folders" | "selected" | "anchor" | "onCreate">> = {}) {
  const props = {
    folders,
    selected: ["b"],
    anchor: { top: 10, left: 20 },
    onToggle: vi.fn(),
    onCreate: vi.fn(async () => null),
    onClose: vi.fn(),
    ...over,
  };
  render(<FolderPicker {...props} />);
  return props;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("FolderPicker", () => {
  it("フォルダを並べ、入っているものは押された状態", () => {
    setup();
    expect(screen.getByRole("button", { name: "ゲーム" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "料理" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("押すと出し入れを知らせる", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "ゲーム" }));
    fireEvent.click(screen.getByRole("button", { name: "料理" }));
    expect(p.onToggle.mock.calls).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });

  it("フォルダが無ければその旨を出す", () => {
    setup({ folders: [] });
    expect(screen.getByText("フォルダがまだありません")).toBeTruthy();
  });

  it("新しいフォルダ: 失敗なら理由を出し、成功なら入力を空にする", async () => {
    const onCreate = vi.fn(async (name: string) => (name === "料理" ? ("duplicate" as const) : null));
    setup({ onCreate });
    const input = screen.getByLabelText("新しいフォルダの名前") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "料理" } });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });
    expect(screen.getByRole("alert").textContent).toBe("同じ名前のフォルダがあります");
    fireEvent.change(input, { target: { value: "旅行" } });
    await act(async () => {
      fireEvent.submit(input.closest("form")!);
    });
    expect(onCreate).toHaveBeenLastCalledWith("旅行");
    expect(input.value).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("8 秒操作がなければ閉じる。操作すると数え直す", () => {
    const p = setup();
    act(() => {
      vi.advanceTimersByTime(PICKER_AUTO_CLOSE_MS - 3000);
    });
    fireEvent.click(screen.getByRole("button", { name: "ゲーム" }));
    act(() => {
      vi.advanceTimersByTime(PICKER_AUTO_CLOSE_MS - 1000);
    });
    expect(p.onClose).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(p.onClose).toHaveBeenCalledTimes(1);
  });

  it("× で閉じる", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(p.onClose).toHaveBeenCalled();
  });
});
