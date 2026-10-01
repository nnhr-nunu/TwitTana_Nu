import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  { ignores: [".output/**", ".wxt/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // 開発用のスクリプトは Node で動く
  { files: ["scripts/**"], languageOptions: { globals: { console: "readonly", process: "readonly" } } },
];
