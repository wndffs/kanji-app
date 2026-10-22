import { Buffer } from "node:buffer";
import { constants } from "node:fs";
import { lstat, open, realpath, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const require = createRequire(import.meta.url);
const DEFAULT_BUILD_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../apps/web/.next");
export const STUDY_ROUTES = Object.freeze([
  "/dashboard",
  "/lessons",
  "/reviews",
  "/items/[id]",
  "/characters",
  "/kana",
  "/settings",
]);
export const STARTING_BUDGETS = Object.freeze({
  route: Object.freeze({
    js: Object.freeze({ rawB: 1_572_864, gzipB: 358_400 }),
    css: Object.freeze({ rawB: 262_144, gzipB: 40_960 }),
  }),
  totalDistinct: Object.freeze({
    js: Object.freeze({ rawB: 4_194_304, gzipB: 1_048_576 }),
    css: Object.freeze({ rawB: 524_288, gzipB: 81_920 }),
  }),
});
const MAX_HTML_BYTES = 4 * 1024 * 1024;
const MAX_ASSET_BYTES = 16 * 1024 * 1024;
const MAX_DISTINCT_BYTES = 64 * 1024 * 1024;
const MAX_ROUTE_ASSETS = 128;

class MeasurementError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const fail = (code) => {
  throw new MeasurementError(code);
};

function htmlParser() {
  // An existing MIT parser bundled with the installed, reviewed Next release.
  // Never evaluate emitted client/server manifest JavaScript.
  if (require("next/package.json").version !== "16.4.2") fail("UNREVIEWED_PARSER_VERSION");
  const { parse } = require("next/dist/compiled/node-html-parser");
  if (typeof parse !== "function") fail("UNSUPPORTED_HTML_PARSER");
  return parse;
}

export function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === "--build-complete") {
      if (options.buildComplete !== undefined) fail("INVALID_ARGUMENTS");
      options.buildComplete = true;
      continue;
    }
    const key = flag === "--build-dir" ? "buildDir" : flag === "--html-dir" ? "htmlDir" : null;
    const value = args[index + 1];
    if (
      key === null ||
      Object.hasOwn(options, key) ||
      typeof value !== "string" ||
      value.trim() === "" ||
      value.startsWith("--") ||
      /[\0\r\n]/u.test(value)
    )
      fail("INVALID_ARGUMENTS");
    options[key] = value;
    index++;
  }
  return options;
}

export function normalizeAssetPath(url) {
  if (typeof url !== "string" || !url.startsWith("/_next/static/")) fail("UNSUPPORTED_ASSET_URL");
  // No arbitrary URLs, query parameters, traversal, drive paths or source maps.
  const path = url.replace(/%5b/giu, "[").replace(/%5d/giu, "]");
  if (!/^\/_next\/static\/(?:chunks|css)\/[A-Za-z0-9_@.()[\]/-]+\.(?:js|css)$/u.test(path))
    fail("UNSUPPORTED_ASSET_URL");
  const parts = path.slice("/_next/".length).split("/");
  if (parts.some((part) => !part || part.startsWith("."))) fail("UNSAFE_ASSET_PATH");
  return parts.join("/");
}

export function initialAssetsFromHtml(html, route) {
  if (!STUDY_ROUTES.includes(route)) fail("UNSUPPORTED_ROUTE");
  if (
    typeof html !== "string" ||
    !/^\s*<!doctype html>/iu.test(html) ||
    !/<\/html>\s*$/iu.test(html)
  )
    fail("INCOMPLETE_HTML");
  const document = htmlParser()(html);
  if (!document.querySelector("html") || !document.querySelector("body")) fail("INCOMPLETE_HTML");
  const assets = new Set();
  for (const element of document.querySelectorAll("script,link,style")) {
    let parent = element.parentNode;
    let inert = false;
    while (parent) {
      if (["TEMPLATE", "NOSCRIPT"].includes(parent.tagName)) {
        inert = true;
        break;
      }
      parent = parent.parentNode;
    }
    if (inert) continue;
    if (element.tagName === "STYLE") fail("UNSUPPORTED_INLINE_CSS");
    let url;
    let extension;
    if (element.tagName === "SCRIPT") {
      const type = (element.getAttribute("type") ?? "").toLowerCase();
      if (!["", "module", "text/javascript", "application/javascript"].includes(type)) continue;
      url = element.getAttribute("src");
      if (url === undefined) continue; // Inline bootstrap/RSC is not an external bundle.
      extension = ".js";
    } else {
      const rel = (element.getAttribute("rel") ?? "").toLowerCase().split(/\s+/u);
      const as = (element.getAttribute("as") ?? "").toLowerCase();
      if (rel.includes("stylesheet") || (rel.includes("preload") && as === "style"))
        extension = ".css";
      else if (rel.includes("modulepreload") || (rel.includes("preload") && as === "script"))
        extension = ".js";
      else continue; // Fonts, icons, prefetch and other non-initial assets.
      url = element.getAttribute("href");
    }
    const asset = normalizeAssetPath(url);
    if (!asset.endsWith(extension)) fail("UNSUPPORTED_ASSET_TYPE");
    assets.add(asset);
    if (assets.size > MAX_ROUTE_ASSETS) fail("TOO_MANY_INITIAL_ASSETS");
  }
  if (![...assets].some((asset) => asset.endsWith(".js"))) fail("MISSING_INITIAL_JS");
  if (![...assets].some((asset) => asset.endsWith(".css"))) fail("MISSING_INITIAL_CSS");
  return [...assets].sort();
}

async function rootDirectory(path) {
  try {
    const root = await realpath(path);
    if (!(await stat(root)).isDirectory()) fail("UNAVAILABLE_DIRECTORY");
    return root;
  } catch {
    fail("UNAVAILABLE_DIRECTORY");
  }
}

async function readBounded(root, path, maxBytes) {
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || /[\\:\0]/u.test(part)))
    fail("UNSAFE_INPUT_PATH");
  const candidate = join(root, ...parts);
  let handle;
  try {
    // Refuse links at every level, including links to a file outside the artifact root.
    for (let index = 1; index <= parts.length; index++)
      if ((await lstat(join(root, ...parts.slice(0, index)))).isSymbolicLink())
        fail("UNSAFE_FILE_LINK");
    const actual = await realpath(candidate);
    const within = relative(root, actual);
    if (isAbsolute(within) || within === ".." || within.startsWith(`..${sep}`))
      fail("UNSAFE_INPUT_PATH");
    handle = await open(candidate, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const info = await handle.stat();
    if (!info.isFile() || info.size < 1 || info.size > maxBytes) fail("INVALID_FILE_SIZE");
    // A bounded read also handles a file growing after stat without buffering it all.
    const buffer = Buffer.alloc(info.size + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length !== info.size) fail("CHANGED_INPUT_FILE");
    return buffer.subarray(0, length);
  } catch (error) {
    if (error instanceof MeasurementError) throw error;
    fail("UNAVAILABLE_FILE");
  } finally {
    await handle?.close();
  }
}

function sizes(paths, assets) {
  const result = { js: { assets: 0, rawB: 0, gzipB: 0 }, css: { assets: 0, rawB: 0, gzipB: 0 } };
  for (const path of paths) {
    const measured = assets.get(path);
    const kind = path.endsWith(".js") ? "js" : "css";
    result[kind].assets++;
    result[kind].rawB += measured.rawB;
    result[kind].gzipB += measured.gzipB;
  }
  return result;
}

function budgetExcess(scope, metrics, budget) {
  return ["js", "css"].flatMap((kind) =>
    ["rawB", "gzipB"].flatMap((unit) =>
      metrics[kind][unit] > budget[kind][unit]
        ? [{ scope, kind, unit, actual: metrics[kind][unit], budget: budget[kind][unit] }]
        : [],
    ),
  );
}

async function buildGuard(root) {
  const id = await readBounded(root, "BUILD_ID", 256);
  if (!/^[A-Za-z0-9_-]{1,128}\s*$/u.test(id.toString("utf8"))) fail("UNSUPPORTED_BUILD_ID");
  let framework;
  try {
    framework = JSON.parse(
      (await readBounded(root, "diagnostics/framework.json", 4096)).toString("utf8"),
    );
  } catch {
    fail("UNCONFIRMED_BUILD_FRAMEWORK");
  }
  if (framework?.name !== "Next.js" || framework?.version !== "16.4.2")
    fail("UNREVIEWED_BUILD_FRAMEWORK");
  return id.toString("utf8");
}

export async function measureWebBundles({
  buildDir = DEFAULT_BUILD_DIR,
  htmlDir,
  buildComplete = false,
} = {}) {
  const assets = new Map();
  const routes = [];
  let totalReadBytes = 0;
  let buildRoot;
  let htmlRoot;
  let guard;
  let inputError = "UNAVAILABLE_DIRECTORY";
  try {
    // BUILD_ID is written before static generation, not as a success marker.
    // Require an operator-confirmed successful build, never infer it from files alone.
    if (buildComplete !== true) fail("BUILD_COMPLETION_UNCONFIRMED");
    buildRoot = await rootDirectory(buildDir);
    htmlRoot = htmlDir === undefined ? buildRoot : await rootDirectory(htmlDir);
    guard = await buildGuard(buildRoot);
  } catch (error) {
    inputError = error instanceof MeasurementError ? error.code : "UNSUPPORTED_INPUT";
    // No absolute paths or exception messages in a report.
  }
  for (const route of STUDY_ROUTES) {
    try {
      if (!buildRoot || !htmlRoot || guard === undefined) fail(inputError);
      const filename = `${route.slice(1)}.html`;
      const html = await readBounded(
        htmlRoot,
        htmlDir === undefined ? `server/app/${filename}` : filename,
        MAX_HTML_BYTES,
      );
      const paths = initialAssetsFromHtml(html.toString("utf8"), route);
      for (const path of paths) {
        if (assets.has(path)) continue;
        const data = await readBounded(buildRoot, path, MAX_ASSET_BYTES);
        totalReadBytes += data.length;
        if (totalReadBytes > MAX_DISTINCT_BYTES) fail("TOTAL_INPUT_LIMIT");
        assets.set(path, { rawB: data.length, gzipB: gzipSync(data, { level: 9 }).length });
      }
      routes.push({ route, status: "measured", paths });
    } catch (error) {
      routes.push({
        route,
        status: "unavailable",
        code: error instanceof MeasurementError ? error.code : "UNSUPPORTED_INPUT",
      });
    }
  }
  if (guard !== undefined) {
    let unchanged = false;
    try {
      unchanged = (await buildGuard(buildRoot)) === guard;
    } catch {
      /* Incomplete/replaced build. */
    }
    if (!unchanged) {
      for (let index = 0; index < routes.length; index++)
        routes[index] = {
          route: STUDY_ROUTES[index],
          status: "unavailable",
          code: "BUILD_CHANGED_DURING_MEASUREMENT",
        };
    }
  }
  const uses = new Map();
  for (const entry of routes)
    for (const path of entry.paths ?? []) uses.set(path, (uses.get(path) ?? 0) + 1);
  const distinct = [...uses.keys()].sort();
  const shared = distinct.filter((path) => uses.get(path) > 1);
  const totalDistinct = sizes(distinct, assets);
  const excess = [];
  const measuredRoutes = routes.map((entry) => {
    if (entry.status !== "measured") return entry;
    const initial = sizes(entry.paths, assets);
    excess.push(...budgetExcess(entry.route, initial, STARTING_BUDGETS.route));
    return {
      route: entry.route,
      status: "measured",
      initial,
      shared: sizes(
        entry.paths.filter((path) => uses.get(path) > 1),
        assets,
      ),
    };
  });
  excess.push(...budgetExcess("totalDistinct", totalDistinct, STARTING_BUDGETS.totalDistinct));
  const complete = routes.every((entry) => entry.status === "measured");
  return {
    schemaVersion: 1,
    metric: "html-referenced-external-initial-js-css",
    buildCompletion: buildComplete === true ? "operator-confirmed" : "unconfirmed",
    status: !complete ? "incomplete" : excess.length ? "exceeded" : "passed",
    coverage: {
      expected: STUDY_ROUTES.length,
      measured: routes.filter((entry) => entry.status === "measured").length,
    },
    routes: measuredRoutes,
    totalDistinct,
    sharedDistinct: sizes(shared, assets),
    budgets: STARTING_BUDGETS,
    excess,
  };
}

export async function main(args = process.argv.slice(2), output = console.log) {
  try {
    const report = await measureWebBundles(parseArgs(args));
    output(JSON.stringify(report, null, 2));
    return report.status === "passed" ? 0 : report.status === "exceeded" ? 1 : 2;
  } catch (error) {
    output(
      JSON.stringify({
        status: "incomplete",
        code: error instanceof MeasurementError ? error.code : "UNSUPPORTED_INPUT",
      }),
    );
    return 2;
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  process.exitCode = await main();
