import { browser } from "#imports";
import { localDateString } from "../core/review";
import { remainingReviewCount } from "../db/review-repo";
import { getDb } from "../db/schema";

/** 拡張アイコンに「今日の積みツイ崩し」の残り件数を出す（0 なら消す） */
export async function refreshBadge(): Promise<void> {
  const n = await remainingReviewCount(getDb(), localDateString(new Date()));
  await browser.action.setBadgeBackgroundColor({ color: "#7c5a3a" });
  await browser.action.setBadgeText({ text: n > 0 ? String(n) : "" });
}
