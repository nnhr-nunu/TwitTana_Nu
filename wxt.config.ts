import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  imports: false,
  modules: ["@wxt-dev/module-react"],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",
    default_locale: "ja",
    permissions: ["unlimitedStorage"],
    action: { default_title: "__MSG_actionTitle__" },
  },
});
