import { ja } from "./ja";

export { ja };
export type MessageKey = keyof typeof ja;

/** 文言を引く。{名前} を params の値で置き換える（英語は計画4で足す） */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  let text: string = ja[key];
  for (const [name, value] of Object.entries(params)) text = text.split(`{${name}}`).join(String(value));
  return text;
}
