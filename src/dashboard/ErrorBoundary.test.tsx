// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Broken(): never {
  throw new Error("壊れたデータ");
}

describe("ErrorBoundary", () => {
  it("中で例外が出たら、真っ白にせず理由と案内を出す", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary resetKey="shelf">
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert").textContent).toContain("壊れたデータ");
    expect(screen.getByRole("button", { name: "もう一度表示する" })).toBeTruthy();
  });

  it("resetKey が変われば（別のタブに移れば）表示し直す", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(
      <ErrorBoundary resetKey="shelf">
        <Broken />
      </ErrorBoundary>,
    );
    rerender(
      <ErrorBoundary resetKey="settings">
        <p>設定</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("設定")).toBeTruthy();
    fireEvent.click(screen.getByText("設定"));
  });
});
