import { browser, defineBackground } from "#imports";
import { refreshBadge } from "../background/badge";
import { handleRequest } from "../background/handlers";
import { isBgRequest, type BgRequest } from "../background/protocol";
import { getDb } from "../db/schema";

const DASHBOARD_PATH = "/dashboard.html";
const BADGE_AFFECTING = new Set<BgRequest["type"]>(["save-posts", "refresh-badge"]);

/** 本棚画面を開く。既に開いているタブがあればそこへ移る */
async function openDashboard(): Promise<void> {
  const url = browser.runtime.getURL(DASHBOARD_PATH);
  const contexts = await browser.runtime.getContexts({
    contextTypes: [browser.runtime.ContextType.TAB],
    documentUrls: [url],
  });
  const found = contexts[0];
  if (found && found.tabId !== -1) {
    await browser.tabs.update(found.tabId, { active: true });
    if (found.windowId !== -1) await browser.windows.update(found.windowId, { focused: true });
    return;
  }
  await browser.tabs.create({ url });
}

function updateBadgeQuietly(): void {
  refreshBadge().catch(() => {
    // 件数表示の失敗は致命的ではない
  });
}

export default defineBackground(() => {
  browser.action.onClicked.addListener(() => {
    void openDashboard();
  });

  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isBgRequest(message)) return false;
    handleRequest(getDb(), message, new Date().toISOString())
      .then((res) => {
        sendResponse(res);
        if (BADGE_AFFECTING.has(message.type)) updateBadgeQuietly();
      })
      .catch((e: unknown) => sendResponse({ error: e instanceof Error ? e.message : String(e) }));
    return true; // 非同期で返事をする
  });

  browser.runtime.onStartup.addListener(updateBadgeQuietly);
  browser.runtime.onInstalled.addListener(updateBadgeQuietly);
  updateBadgeQuietly();
});
