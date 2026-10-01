import { browser, defineBackground } from "#imports";

const DASHBOARD_PATH = "/dashboard.html";

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

export default defineBackground(() => {
  browser.action.onClicked.addListener(() => {
    void openDashboard();
  });
});
