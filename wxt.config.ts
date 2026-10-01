import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  imports: false,
  modules: ["@wxt-dev/module-react"],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: "ツイッ棚",
    description: "Twitter（現 X）のブックマークを自分のフォルダに整理して見返す（非公式）",
    permissions: ["unlimitedStorage"],
    action: { default_title: "ツイッ棚を開く" },
  },
});
