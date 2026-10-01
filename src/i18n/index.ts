import { en } from "./en";
import { ja } from "./ja";

export { ja };
export type MessageKey = keyof typeof ja;
export type Language = "ja" | "en";
export type LanguageSetting = "auto" | Language;

const DICTIONARIES: Record<Language, Record<MessageKey, string>> = { ja, en };
let current: Language = "ja";

/** auto はブラウザの言語が日本語なら日本語、それ以外は英語 */
export function resolveLanguage(setting: LanguageSetting, browserLanguage: string): Language {
  if (setting !== "auto") return setting;
  return browserLanguage.toLowerCase().startsWith("ja") ? "ja" : "en";
}

/** 表示言語を決める（本棚画面と x.com 上の画面が、設定を読んだら呼ぶ） */
export function setLanguage(setting: LanguageSetting): Language {
  current = resolveLanguage(setting, typeof navigator === "undefined" ? "ja" : navigator.language);
  return current;
}

export function getLanguage(): Language {
  return current;
}

/** 今の言語の文言を引く。{名前} を params の値で置き換える */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  let text = DICTIONARIES[current][key];
  for (const [name, value] of Object.entries(params)) text = text.split(`{${name}}`).join(String(value));
  return text;
}
