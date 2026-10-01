// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makePost } from "../test/factories";
import { openTestDb } from "../test/db";
import { DbProvider } from "./db-context";
import { Organize } from "./Organize";

const db = openTestDb();
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await Promise.all([db.posts.clear(), db.folders.clear(), db.rules.clear(), db.kv.clear()]);
});

function renderOrganize() {
  render(
    <DbProvider value={db}>
      <Organize />
    </DbProvider>,
  );
}

describe("フォルダの編集", () => {
  it("作る・重複は理由を出す", async () => {
    renderOrganize();
    const input = await screen.findByLabelText("新しいフォルダの名前");
    fireEvent.change(input, { target: { value: "ゲーム" } });
    fireEvent.click(screen.getByRole("button", { name: "追加" }));
    const row = await screen.findByRole("textbox", { name: "フォルダの名前" });
    expect((row as HTMLInputElement).value).toBe("ゲーム");
    fireEvent.change(input, { target: { value: "ｹﾞｰﾑ" } });
    fireEvent.click(screen.getByRole("button", { name: "追加" }));
    expect((await screen.findByRole("alert")).textContent).toBe("同じ名前のフォルダがあります");
  });

  it("名前を重複する名前に変えると理由を出して元に戻す", async () => {
    await db.folders.bulkPut([
      { id: "a", name: "A", description: "", order: 0, createdAt: "" },
      { id: "b", name: "B", description: "", order: 1, createdAt: "" },
    ]);
    renderOrganize();
    const inputs = await screen.findAllByRole("textbox", { name: "フォルダの名前" });
    const b = inputs[1] as HTMLInputElement;
    fireEvent.change(b, { target: { value: "A" } });
    fireEvent.blur(b);
    expect((await screen.findByRole("alert")).textContent).toBe("同じ名前のフォルダがあります");
    await waitFor(() => expect(b.value).toBe("B"));
    expect((await db.folders.get("b"))?.name).toBe("B");
  });

  it("確認してから削除する", async () => {
    await db.folders.put({ id: "a", name: "A", description: "", order: 0, createdAt: "" });
    renderOrganize();
    await screen.findByRole("textbox", { name: "フォルダの名前" });
    // happy-dom には window.confirm が無いので、spyOn の前に土台だけ用意する
    window.confirm = () => true;
    vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    expect(await db.folders.get("a")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    await waitFor(async () => expect(await db.folders.get("a")).toBeUndefined());
  });
});

describe("ルールの編集", () => {
  it("値が空なら保存しない。入れれば保存し、今すぐ適用で振り分ける", async () => {
    await db.folders.put({ id: "a", name: "ゲーム", description: "", order: 0, createdAt: "" });
    await db.posts.put(makePost({ id: "1", text: "Unity 講座" }));
    renderOrganize();
    const save = await screen.findByRole("button", { name: "ルールを追加" });
    fireEvent.click(save);
    expect(await screen.findByText("条件の値を入れてください")).toBeTruthy();
    expect(await db.rules.count()).toBe(0);

    fireEvent.change(screen.getByLabelText("本文に含む"), { target: { value: "unity" } });
    fireEvent.click(save);
    await waitFor(async () => expect(await db.rules.count()).toBe(1));
    fireEvent.click(screen.getByRole("button", { name: "未整理に今すぐ適用" }));
    expect(await screen.findByText("1 件を振り分けました")).toBeTruthy();
    expect((await db.posts.get("1"))?.folders).toEqual([{ folderId: "a", by: "rule" }]);
  });
});
