// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildExport } from "../core/export-format";
import { getSettings } from "../db/settings";
import { makePost } from "../test/factories";
import { openTestDb } from "../test/db";
import { DbProvider } from "./db-context";
import { SettingsPanel } from "./SettingsPanel";

const db = openTestDb();
afterEach(async () => {
  cleanup();
  await Promise.all([db.posts.clear(), db.folders.clear(), db.rules.clear(), db.kv.clear()]);
});

function renderPanel() {
  render(
    <DbProvider value={db}>
      <SettingsPanel />
    </DbProvider>,
  );
}

function upload(text: string) {
  const input = screen.getByLabelText("読み込む") as HTMLInputElement;
  const file = new File([text], "backup.json", { type: "application/json" });
  fireEvent.change(input, { target: { files: [file] } });
}

describe("SettingsPanel", () => {
  it("メニューの表示を切り替えると保存する", async () => {
    renderPanel();
    const box = await screen.findByLabelText("ブクマした瞬間にフォルダ選択メニューを出す");
    fireEvent.click(box);
    await waitFor(async () => expect((await getSettings(db)).pickerOnBookmark).toBe(false));
  });

  it("ツイッ棚の書き出しファイルを読み込み、結果を出す", async () => {
    renderPanel();
    await screen.findByLabelText("読み込む");
    upload(JSON.stringify(buildExport({ folders: [], rules: [], posts: [makePost({ id: "1" })] }, "2026-10-02T00:00:00.000Z")));
    expect(await screen.findByText("読み込みました：投稿 1 件・新しいフォルダ 0 個・新しいルール 0 個")).toBeTruthy();
    expect(await db.posts.get("1")).toBeDefined();
  });

  it("別のファイルは何も変えずに理由を出す", async () => {
    renderPanel();
    await screen.findByLabelText("読み込む");
    upload(JSON.stringify({ app: "other" }));
    expect(await screen.findByText("ツイッ棚の書き出しファイルではありません")).toBeTruthy();
    expect(await db.posts.count()).toBe(0);
  });

  it("読み取りの調子が悪いときは警告を出す", async () => {
    await db.kv.put({ key: "settings", value: { parseHealth: { lastErrorAt: "2026-10-02T00:00:00.000Z", lastErrorOp: "Bookmarks" } } });
    renderPanel();
    expect((await screen.findByRole("alert")).textContent).toContain("Bookmarks");
  });
});
