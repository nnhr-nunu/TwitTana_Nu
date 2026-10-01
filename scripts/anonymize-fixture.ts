// X の返事 JSON を匿名化してテスト用データにする。npm run anonymize -- <入力.json> <出力.json>
import { readFile, writeFile } from "node:fs/promises";
import { anonymize } from "../src/devtools/anonymize.ts";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("使い方: npm run anonymize -- <入力.json> <出力.json>");
  process.exit(1);
}
const json: unknown = JSON.parse(await readFile(input, "utf8"));
await writeFile(output, `${JSON.stringify(anonymize(json), null, 2)}\n`, "utf8");
console.log(`匿名化して ${output} に書き出しました。中身に個人の情報が残っていないか、目でも確かめてからコミットしてください。`);
