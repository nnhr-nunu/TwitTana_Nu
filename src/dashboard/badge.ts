import { browser } from "#imports";

/** 裏方に、拡張アイコンの件数を数え直してもらう（失敗しても気にしない） */
export function requestBadgeRefresh(): void {
  try {
    void browser.runtime.sendMessage({ type: "refresh-badge" }).catch(() => {});
  } catch {
    // テスト環境など、送れないときは何もしない
  }
}
