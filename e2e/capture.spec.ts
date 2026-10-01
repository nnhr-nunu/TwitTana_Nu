import { expect, test } from "./fixtures";

test("ブクマ画面を開くと取り込まれ、X の画面は普段どおり描かれ、本棚画面に出る", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto("https://x.com/i/bookmarks");
  await expect(page.getByText("ブクマ1本文")).toBeVisible();
  await expect(page.getByText("ブクマ2本文")).toBeVisible();
  await expect(page.getByText(/ツイッ棚：このページで 2 件取り込み/)).toBeVisible();

  const shelf = await context.newPage();
  await shelf.goto(`chrome-extension://${extensionId}/dashboard.html`);
  const list = shelf.getByRole("list", { name: "投稿の一覧" });
  await expect(list.getByRole("article")).toHaveCount(2);
  await expect(list.getByText("ブクマ1本文")).toBeVisible();
});
