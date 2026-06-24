import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(dirname, "../.."),
  transpilePackages: ["@kanji-srs/shared", "@kanji-srs/ui"],
};

export default nextConfig;
