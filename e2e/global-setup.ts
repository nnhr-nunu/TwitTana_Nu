import { execSync } from "node:child_process";

/** E2E 用に拡張をビルドする。WXT_E2E=1 のときだけ x.com 上の画面の Shadow DOM を開く（テストから探せるように） */
export default function globalSetup(): void {
  execSync("npx wxt build", { stdio: "inherit", env: { ...process.env, WXT_E2E: "1" } });
}
