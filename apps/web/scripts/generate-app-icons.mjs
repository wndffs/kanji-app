import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
// Reuse Next's existing image codec only for this build-time asset generator.
const sharp = createRequire(require.resolve("next/package.json"))("sharp");
const source = await readFile(resolve(root, "src/app/icon.svg"));
await mkdir(resolve(root, "public/icons"), { recursive: true });

for (const [size, path] of [
  [192, "public/icons/app-192.png"],
  [512, "public/icons/app-512.png"],
  [180, "src/app/apple-icon.png"],
]) {
  await sharp(source)
    .resize(size, size)
    .flatten({ background: "#2364aa" })
    .png()
    .toFile(resolve(root, path));
}
