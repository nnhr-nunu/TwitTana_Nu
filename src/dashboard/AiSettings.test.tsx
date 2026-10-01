// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSettings } from "../db/settings";
import { openTestDb } from "../test/db";
import { AiSettings } from "./AiSettings";
import { DbProvider } from "./db-context";

const g = globalThis as { LanguageModel?: unknown };
const db = openTestDb();
afterEach(async () => {
  cleanup();
  delete g.LanguageModel;
  await db.kv.clear();
});

function renderAi() {
  render(
    <DbProvider value={db}>
      <AiSettings />
    </DbProvider>,
  );
}

describe("AiSettings", () => {
  it("AI の無いブラウザでは使えない旨だけを出す", async () => {
    renderAi();
    expect(await screen.findByText("この PC・ブラウザでは AI 分類は使えません。ルールでの振り分けは使えます。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "AI を準備する" })).toBeNull();
  });

  it("未取得なら準備ボタンで準備し、使える状態にしてオンにする", async () => {
    let state = "downloadable";
    g.LanguageModel = {
      availability: vi.fn(async () => state),
      create: vi.fn(async () => {
        state = "available";
        return { prompt: vi.fn(), clone: vi.fn(), destroy: vi.fn() };
      }),
    };
    renderAi();
    fireEvent.click(await screen.findByRole("button", { name: "AI を準備する" }));
    await waitFor(async () => expect((await getSettings(db)).aiEnabled).toBe(true));
    expect(await screen.findByText("この PC で使えます")).toBeTruthy();
    const box = screen.getByLabelText("未整理の投稿を AI で自動的に振り分ける") as HTMLInputElement;
    expect(box.checked).toBe(true);
  });
});
