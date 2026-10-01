// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { localDateString } from "../core/review";
import { makePost } from "../test/factories";
import { openTestDb } from "../test/db";
import { DbProvider } from "./db-context";
import { Shelf } from "./Shelf";

const db = openTestDb();
afterEach(async () => {
  cleanup();
  await Promise.all([db.posts.clear(), db.folders.clear(), db.rules.clear(), db.kv.clear()]);
});

async function seed() {
  await db.folders.put({ id: "a", name: "ゲーム", description: "", order: 0, createdAt: "" });
  await db.posts.bulkPut([
    makePost({ id: "1", text: "未整理の投稿", bookmarkOrder: "10", review: { count: 1, lastAt: "2026-01-01T00:00:00.000Z" } }),
    makePost({ id: "2", text: "ゲームの投稿", bookmarkOrder: "20", folders: [{ folderId: "a", by: "manual" }], review: { count: 1, lastAt: "2026-01-01T00:00:00.000Z" } }),
    makePost({ id: "3", text: "隠した投稿", hidden: true }),
  ]);
}

function renderShelf() {
  render(
    <DbProvider value={db}>
      <Shelf />
    </DbProvider>,
  );
}

describe("Shelf", () => {
  it("非表示以外を新しいブクマ順に出し、絞り込みで切り替える", async () => {
    await seed();
    renderShelf();
    const list = await screen.findByRole("list", { name: "投稿の一覧" });
    await waitFor(() => expect(within(list).getAllByRole("article")).toHaveLength(2));
    expect(within(list).getAllByRole("article").map((a) => a.textContent?.includes("ゲームの投稿"))).toEqual([true, false]);
    expect(screen.queryByText("隠した投稿")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /未整理/ }));
    await waitFor(() => expect(within(list).getAllByRole("article")).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: /非表示にしたもの/ }));
    expect(await within(list).findByText("隠した投稿")).toBeTruthy();
  });

  it("検索で絞り込む", async () => {
    await seed();
    renderShelf();
    const list = await screen.findByRole("list", { name: "投稿の一覧" });
    fireEvent.change(screen.getByLabelText("本文・名前・@名で検索"), { target: { value: "ゲーム" } });
    await waitFor(() => expect(within(list).getAllByRole("article")).toHaveLength(1));
  });

  it("選んでフォルダに入れると DB に手動で入る", async () => {
    await seed();
    renderShelf();
    const list = await screen.findByRole("list", { name: "投稿の一覧" });
    await waitFor(() => expect(within(list).getAllByRole("checkbox")).toHaveLength(2));
    const checkboxes = within(list).getAllByRole("checkbox");
    fireEvent.click(checkboxes[1] as HTMLElement);
    fireEvent.change(screen.getByLabelText("フォルダを選ぶ"), { target: { value: "a" } });
    fireEvent.click(screen.getByRole("button", { name: "入れる" }));
    await waitFor(async () => expect((await db.posts.get("1"))?.folders).toEqual([{ folderId: "a", by: "manual" }]));
  });

  it("今日の積みツイ崩しで『見た』を押すと済みになる", async () => {
    await db.posts.put(makePost({ id: "9", text: "昔のブクマ" }));
    renderShelf();
    const strip = await screen.findByRole("region", { name: "今日の積みツイ崩し" });
    fireEvent.click(await within(strip).findByRole("button", { name: "見た" }));
    expect(await within(strip).findByText("今日の分はおしまい！また明日。")).toBeTruthy();
    expect((await db.posts.get("9"))?.review.count).toBe(1);
    const settings = await db.kv.get("settings");
    expect((settings?.value as { todayReview?: { date: string } }).todayReview?.date).toBe(localDateString(new Date()));
  });
});
