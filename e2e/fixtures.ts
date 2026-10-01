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
