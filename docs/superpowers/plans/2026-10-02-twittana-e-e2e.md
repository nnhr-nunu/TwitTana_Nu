# ツイッ棚 計画5：本物のブラウザでのつなぎ確認（E2E） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ビルドした拡張を Playwright 付属の Chromium に読み込み、X の画面を真似た偽ページで「通信を横で読む → 橋渡し → 裏方で保存 → メニュー表示 → 本棚画面」までが本当につながることを自動で確かめる。

**Architecture:** Playwright の `launchPersistentContext` で拡張を読み込み、`context.route` で `https://x.com/**` への通信をすべて偽の HTML と JSON で返す（本物の x.com には一切つながない）。それ以外の外部への通信は遮断する。偽ページは X と同じく `fetch` と `XMLHttpRequest` で GraphQL を呼び、その結果を画面に描く（拡張が X の画面を壊していないことも確かめる）。

**Tech Stack:** @playwright/test ＋ Playwright 付属の Chromium（Google Chrome 本体は拡張の読み込み用の起動オプションが無くなったため使えない）

**Spec:** [`docs/superpowers/specs/2026-10-02-twittana-design.md`](../specs/2026-10-02-twittana-design.md)（8 章・9 章の手動・13 章の「X の画面を壊さない」）

**前提:** 計画1〜4 と計画6（見直しの修正）が完了していること。計画6で x.com 上の画面の Shadow DOM を閉じた（ページ側から読めない＝Playwright からも探せない）ので、E2E 用のビルドだけ環境変数 `WXT_E2E=1` で開く。ビルドは Playwright の globalSetup が行う。

## Global Constraints

- 本物の x.com・pbs.twimg.com などへは通信しない。`https://x.com/` 以外の http(s) 通信は `route.abort()` で遮断する
- 偽のデータは `src/x/test-builders.ts` で作る（実データは使わない）
- E2E は `npm test`（Vitest）とは別に `npm run e2e` で動かす。Vitest が `e2e/` を拾わないようにする
- E2E で拡張の不具合が見つかったら、superpowers:systematic-debugging で原因を突き止め、`src/` を最小限直し、可能なら原因を再現する単体テストを足す（E2E のテストを弱めて通さない）

## Review Focus

- 拡張が `fetch` / `XMLHttpRequest` を包んだせいで、X の画面がデータを受け取れなくなる → 偽ページの描画が出ることで確かめる（Task 1・2）
- Shadow DOM の中のメニューが出ない・押せない → メニューで新しいフォルダを作れることで確かめる（Task 2）
- 裏方が眠っていて保存されない → ページを開いた直後の取り込みが本棚画面に出ることで確かめる（Task 1）

---

### Task 1: 土台とブクマ画面の取り込み

**Files:**
- Create: `playwright.config.ts`、`e2e/global-setup.ts`、`e2e/fixtures.ts`、`e2e/fake-x.ts`、`e2e/capture.spec.ts`
- Modify: `vitest.config.ts`（`e2e/` を除く）、`package.json`（`e2e` スクリプト）、`.gitignore`、`eslint.config.mjs`

- [ ] **Step 1: 依存と設定**

Run:

```bash
npm install -D @playwright/test
npx playwright install chromium
```

（2 つ目は Playwright 付属の Chromium を Playwright のキャッシュに入れる。リポジトリには入らない）

`playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  workers: 1,
  reporter: "list",
  use: { trace: "retain-on-failure" },
});
```

`e2e/global-setup.ts`:

```ts
import { execSync } from "node:child_process";

/** E2E 用に拡張をビルドする。WXT_E2E=1 のときだけ x.com 上の画面の Shadow DOM を開く（テストから探せるように） */
export default function globalSetup(): void {
  execSync("npx wxt build", { stdio: "inherit", env: { ...process.env, WXT_E2E: "1" } });
}
```

`vitest.config.ts` を次にする（`e2e/` の `*.spec.ts` を Vitest が拾わないように）:

```ts
import { configDefaults, defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

export default defineConfig({
  plugins: [WxtVitest()],
  test: { setupFiles: ["./vitest.setup.ts"], exclude: [...configDefaults.exclude, "e2e/**"] },
});
```

`package.json` の `scripts` に `"e2e": "playwright test"` を足す（ビルドは globalSetup が行う）。

（`import.meta.env.WXT_E2E` が E2E のビルドで `"1"` にならず、Shadow DOM の中が探せないときは、WXT が `WXT_` で始まる環境変数を `import.meta.env` に渡しているか確かめる。渡っていなければ `wxt.config.ts` の `vite` に `define: { "import.meta.env.WXT_E2E": JSON.stringify(process.env.WXT_E2E ?? "") }` を足す）

`.gitignore` の末尾に足す:

```
# playwright
test-results/
playwright-report/
```

`eslint.config.mjs` の `ignores` に `"test-results/**"`, `"playwright-report/**"` を足す。

- [ ] **Step 2: 偽の X と、拡張を読み込む仕組みを書く**

`e2e/fake-x.ts`:

```ts
import type { BrowserContext, Route } from "@playwright/test";
import { bookmarksResponse, rawTweet, timelineResponse } from "../src/x/test-builders";

export const BOOKMARKED = [
  rawTweet({ id: "1973000000000000601", handle: "alice", name: "アリス", text: "ブクマ1本文" }),
  rawTweet({ id: "1973000000000000602", handle: "bob", name: "ボブ", text: "ブクマ2本文" }),
];
export const TIMELINE_POST = rawTweet({ id: "1973000000000000700", handle: "carol", name: "キャロル", text: "タイムラインの投稿" });

/** ブクマ画面：X と同じく fetch で一覧を取り、本文を描く */
const BOOKMARKS_HTML = `<!doctype html><html><body><main id="app">loading</main><script>
fetch("/i/api/graphql/q1/Bookmarks?variables=%7B%7D")
  .then((r) => r.json())
  .then((json) => {
    const entries = json.data.bookmark_timeline_v2.timeline.instructions[0].entries.filter((e) => e.content.itemContent);
    document.getElementById("app").innerHTML = entries
      .map((e) => '<article data-testid="tweet"><div data-testid="tweetText">' + e.content.itemContent.tweet_results.result.legacy.full_text + "</div></article>")
      .join("");
  });
</script></body></html>`;

/** ホーム：XMLHttpRequest でタイムラインを取り、ブクマボタンつきで描く。ボタンで CreateBookmark を送る */
const HOME_HTML = `<!doctype html><html><body><main id="app">loading</main><script>
const xhr = new XMLHttpRequest();
xhr.open("GET", "/i/api/graphql/q2/HomeTimeline?variables=%7B%7D");
xhr.onload = () => {
  const json = JSON.parse(xhr.responseText);
  const t = json.data.home.home_timeline_urt.instructions[0].entries[0].content.itemContent.tweet_results.result;
  const handle = t.core.user_results.result.core.screen_name;
  document.getElementById("app").innerHTML =
    '<article data-testid="tweet"><a href="/' + handle + "/status/" + t.rest_id + '"><time datetime="2026-09-01T00:00:00.000Z">9月1日</time></a>' +
    '<div data-testid="tweetText">' + t.legacy.full_text + "</div>" +
    '<div role="group" style="margin-top:200px"><button data-testid="bookmark">bookmark</button></div></article>';
  document.querySelector('[data-testid="bookmark"]').addEventListener("click", () => {
    fetch("/i/api/graphql/q3/CreateBookmark", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ variables: { tweet_id: t.rest_id }, queryId: "q3" }),
    });
  });
};
xhr.send();
</script></body></html>`;

function json(route: Route, body: unknown) {
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

/** https://x.com/** を偽物で返し、それ以外の外部への通信は遮断する */
export async function routeFakeX(context: BrowserContext): Promise<void> {
  // http(s) だけを対象にする（拡張自身のページ chrome-extension:// は触らない）
  await context.route(/^https?:\/\//, (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== "https://x.com") return route.abort();
    if (url.pathname === "/i/bookmarks") return route.fulfill({ status: 200, contentType: "text/html", body: BOOKMARKS_HTML });
    if (url.pathname === "/home") return route.fulfill({ status: 200, contentType: "text/html", body: HOME_HTML });
    if (url.pathname.endsWith("/Bookmarks")) {
      return json(route, bookmarksResponse(BOOKMARKED.map((tweet, i) => ({ tweet, sortIndex: String(1868000000000000010 - i) }))));
    }
    if (url.pathname.endsWith("/HomeTimeline")) return json(route, timelineResponse([TIMELINE_POST]));
    if (url.pathname.endsWith("/CreateBookmark")) return json(route, { data: { tweet_bookmark_put: "Done" } });
    return route.fulfill({ status: 404, body: "" });
  });
}
```

`e2e/fixtures.ts`:

```ts
import path from "node:path";
import { test as base, chromium, type BrowserContext } from "@playwright/test";
import { routeFakeX } from "./fake-x";

/** ビルドした拡張を読み込んだ Chromium（テストごとに新しいプロファイル） */
export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const pathToExtension = path.resolve(".output/chrome-mv3");
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      locale: "ja-JP",
      args: [`--disable-extensions-except=${pathToExtension}`, `--load-extension=${pathToExtension}`],
    });
    await routeFakeX(context);
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent("serviceworker");
    await use(worker.url().split("/")[2] ?? "");
  },
});

export const expect = test.expect;
```

- [ ] **Step 3: 失敗するテストを書く**

`e2e/capture.spec.ts`:

```ts
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
```

- [ ] **Step 4: 動かす**

Run: `npm run e2e`
Expected: PASS（1 件）。

落ちたら、まず `test-results/` のトレース（`npx playwright show-trace <trace.zip>`）と、拡張の裏方のログを見て原因を突き止める。テストや偽ページの書き方の誤り（セレクタ違いなど）ならテスト側を直し、拡張の不具合なら Global Constraints のとおり `src/` を直す。どちらだったかを記録する。

- [ ] **Step 5: すべて通ることを確かめる**

Run: `npm test` → PASS（`e2e/` は含まれない）/ `npm run typecheck` → エラーなし / `npm run lint` → エラーなし

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts e2e vitest.config.ts package.json package-lock.json .gitignore eslint.config.mjs
git commit -m "E2E: 拡張を読み込んだ Chromium で、ブクマ画面の取り込みから本棚画面までを確かめる" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: タイムラインでのブクマとフォルダ選択メニュー

**Files:**
- Modify: `e2e/capture.spec.ts`（テストを足す）
- Modify: `README.md`、`task.md`

- [ ] **Step 1: 失敗するテストを足す**

`e2e/capture.spec.ts` の末尾に足す:

```ts
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
```

- [ ] **Step 2: 動かす**

Run: `npm run e2e`
Expected: PASS（2 件）。落ちたら Task 1 Step 4 と同じ手順で原因を突き止めて直す。

- [ ] **Step 3: README と task.md を更新する**

`README.md` の「## 開発」の「テスト:」の行の次に足す:

```markdown
ブラウザでのつなぎ確認（偽の X ページを使い、本物の x.com にはつながない）: `npm run e2e`。初回だけ `npx playwright install chromium` が要る。E2E は `.output/chrome-mv3` をテスト用の設定でビルドし直すので、終わったら Chrome で使う前に `npm run build` し直す。
```

`task.md` の「今やっていること」に `- [x] 計画5：E2E（docs/superpowers/plans/2026-10-02-twittana-e-e2e.md）` を足す。

- [ ] **Step 4: すべて通ることを確かめて Commit・push**

Run: `npm test` → PASS / `npm run typecheck` → エラーなし / `npm run lint` → エラーなし / `npm run e2e` → PASS

```bash
git add e2e README.md task.md
git commit -m "E2E: タイムラインでのブクマとフォルダ選択メニューを確かめる" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```
