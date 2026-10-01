// アイコンの元絵（SVG）から、拡張に必要な大きさの PNG を作る。npm run icons
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const SIZES = [16, 32, 48, 128];
await mkdir("public/icon", { recursive: true });
for (const size of SIZES) {
  await sharp("src/assets/icon.svg", { density: 384 }).resize(size, size).png().toFile(`public/icon/${size}.png`);
}
console.log(`public/icon/ に ${SIZES.join(", ")} px のアイコンを作りました`);
