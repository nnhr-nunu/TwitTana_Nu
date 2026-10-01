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

test("タイムラインでブクマするとメニューが出て、新しいフォルダに入れられる", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto("https://x.com/home");
  await expect(page.getByText("タイムラインの投稿")).toBeVisible();

  await page.getByRole("button", { name: "bookmark" }).click();
  const picker = page.getByRole("dialog", { name: "ツイッ棚のフォルダ" });
  await expect(picker).toBeVisible();
  await expect(picker.getByText("フォルダがまだありません")).toBeVisible();

  await picker.getByLabel("新しいフォルダの名前").fill("あとで読む");
  await picker.getByRole("button", { name: "追加" }).click();
  await expect(picker.getByRole("button", { name: "あとで読む" })).toHaveAttribute("aria-pressed", "true");

  const shelf = await context.newPage();
  await shelf.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await shelf.getByRole("button", { name: /あとで読む/ }).click();
  const list = shelf.getByRole("list", { name: "投稿の一覧" });
  await expect(list.getByText("タイムラインの投稿")).toBeVisible();
});
