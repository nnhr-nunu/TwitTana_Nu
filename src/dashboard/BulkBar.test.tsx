// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BulkBar } from "./BulkBar";

afterEach(cleanup);

function setup(hiddenView = false) {
  const props = {
    count: 2,
    folders: [{ id: "a", name: "ゲーム", description: "", order: 0, createdAt: "" }],
    hiddenView,
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onToggleHidden: vi.fn(),
    onClear: vi.fn(),
  };
  render(<BulkBar {...props} />);
  return props;
}

describe("BulkBar", () => {
  it("フォルダを選ぶまで入れる・外すは押せない", () => {
    const p = setup();
    expect((screen.getByRole("button", { name: "入れる" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("フォルダを選ぶ"), { target: { value: "a" } });
    fireEvent.click(screen.getByRole("button", { name: "入れる" }));
    fireEvent.click(screen.getByRole("button", { name: "外す" }));
    expect(p.onAdd).toHaveBeenCalledWith("a");
    expect(p.onRemove).toHaveBeenCalledWith("a");
  });

  it("非表示の一覧では『表示に戻す』になる", () => {
    const p = setup(true);
    fireEvent.click(screen.getByRole("button", { name: "表示に戻す" }));
    expect(p.onToggleHidden).toHaveBeenCalled();
    expect(screen.getByText("2 件を選択中")).toBeTruthy();
  });
});
