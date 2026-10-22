import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import {
  initialAssetsFromHtml,
  main,
  measureWebBundles,
  normalizeAssetPath,
  parseArgs,
  STARTING_BUDGETS,
  STUDY_ROUTES,
} from "./measure-web-bundles.mjs";

const shell = (tags: string) =>
  `<!DOCTYPE html><html><head>${tags}</head><body><main>Private body is never reported.</main></body></html>`;
const tags = (extra = "") =>
  shell(
    `<link rel="stylesheet" href="/_next/static/css/shared.css"><script src="/_next/static/chunks/shared.js" async></script>${extra}`,
  );

async function fixture(
  run: (context: {
    root: string;
    buildDir: string;
    write: (path: string, content: string | Buffer) => Promise<void>;
  }) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), "kanji-bundle-test-"));
  const buildDir = join(root, ".next");
  const write = async (path: string, content: string | Buffer) => {
    const file = join(buildDir, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content);
  };
  try {
    await write("BUILD_ID", "synthetic-test-build");
    await write(
      "diagnostics/framework.json",
      JSON.stringify({ name: "Next.js", version: "16.4.2" }),
    );
    await write("static/css/shared.css", "body { color: black; }");
    await write("static/chunks/shared.js", "globalThis.example = true;");
    for (const route of STUDY_ROUTES) await write(`server/app${route}.html`, tags());
    await run({ root, buildDir, write });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("initial HTML bundle asset extraction", () => {
  it("deduplicates scripts/styles/preloads, ignoring inline data, inert markup and prefetch", () => {
    const html = tags(`
      <link rel="preload" as="script" href="/_next/static/chunks/shared.js">
      <link rel="preload" as="style" href="/_next/static/css/shared.css">
      <link rel="modulepreload" href="/_next/static/chunks/module.js">
      <link rel="prefetch" as="script" href="/_next/static/chunks/later.js">
      <link rel="preload" as="font" href="https://font.invalid/private.woff2">
      <script>self.__next_f.push(['<script src="/_next/static/chunks/fake.js">']);</script>
      <script type="application/ld+json">{"private":"text"}</script>
      <template><script src="/_next/static/chunks/template.js"></script></template>
      <noscript><link rel="stylesheet" href="/_next/static/css/noscript.css"></noscript>
      <!-- <script src="/_next/static/chunks/comment.js"></script> -->
    `);
    expect(initialAssetsFromHtml(html, "/dashboard")).toEqual([
      "static/chunks/module.js",
      "static/chunks/shared.js",
      "static/css/shared.css",
    ]);
  });

  it("decodes only route bracket escapes and preserves a strict local asset allowlist", () => {
    expect(normalizeAssetPath("/_next/static/chunks/app/items/%5Bid%5D/page-abc.js")).toBe(
      "static/chunks/app/items/[id]/page-abc.js",
    );
    expect(normalizeAssetPath("/_next/static/chunks/app/items/[id]/page-abc.js")).toBe(
      "static/chunks/app/items/[id]/page-abc.js",
    );
  });

  it.each([
    "https://example.test/_next/static/chunks/a.js",
    "//example.test/a.js",
    "/_next/static/chunks/../secret.js",
    "/_next/static/chunks/%2e%2e/secret.js",
    "/_next/static/chunks/a.js.map",
    "/_next/server/config.js",
    "/_next/static/chunks/a.js?token=private",
    "/_next/static/chunks/a.js#fragment",
    "/_next/static/chunks/C:/a.js",
    "/_next/static/chunks/a\\b.js",
    "/_next/static/chunks//a.js",
    "/_next/static/chunks/.hidden.js",
  ])("rejects unsupported/private asset paths: %s", (path) => {
    expect(() => normalizeAssetPath(path)).toThrow();
  });

  it("refuses unsupported routes and missing/truncated documents instead of reporting zero bytes", () => {
    expect(() => initialAssetsFromHtml(tags(), "/admin")).toThrow("UNSUPPORTED_ROUTE");
    for (const html of ["", "<html></html>", "<!doctype html><html><body>", shell("")])
      expect(() => initialAssetsFromHtml(html, "/dashboard")).toThrow();
    expect(() =>
      initialAssetsFromHtml(
        shell('<script src="/_next/static/chunks/shared.js"></script>'),
        "/dashboard",
      ),
    ).toThrow("MISSING_INITIAL_CSS");
  });

  it("fails closed for inline CSS, external initial JS, bad asset types and excessive assets", () => {
    expect(() =>
      initialAssetsFromHtml(tags("<style>body{color:red}</style>"), "/dashboard"),
    ).toThrow("UNSUPPORTED_INLINE_CSS");
    expect(() =>
      initialAssetsFromHtml(
        tags('<script src="https://cdn.invalid/private.js"></script>'),
        "/dashboard",
      ),
    ).toThrow("UNSUPPORTED_ASSET_URL");
    expect(() =>
      initialAssetsFromHtml(
        tags('<script src="/_next/static/css/shared.css"></script>'),
        "/dashboard",
      ),
    ).toThrow("UNSUPPORTED_ASSET_TYPE");
    expect(() =>
      initialAssetsFromHtml(
        tags(
          Array.from(
            { length: 129 },
            (_, i) => `<script src="/_next/static/chunks/${i}.js"></script>`,
          ).join(""),
        ),
        "/dashboard",
      ),
    ).toThrow("TOO_MANY_INITIAL_ASSETS");
  });
});

describe("read-only bundle measurement and budgets", () => {
  it("requires an explicit completed-build confirmation even when fixture files exist", async () => {
    await fixture(async ({ buildDir }) => {
      const result = await measureWebBundles({ buildDir });
      expect(result.status).toBe("incomplete");
      expect(result.coverage.measured).toBe(0);
      expect(result.routes.every((entry) => entry.code === "BUILD_COMPLETION_UNCONFIRMED")).toBe(
        true,
      );
    });
  });

  it.each(["missing-id", "bad-framework", "invalid-framework-json"])(
    "fails the build guard for %s",
    async (condition) => {
      await fixture(async ({ buildDir, write }) => {
        if (condition === "missing-id") await rm(join(buildDir, "BUILD_ID"));
        if (condition === "bad-framework")
          await write(
            "diagnostics/framework.json",
            JSON.stringify({ name: "Next.js", version: "17.0.0" }),
          );
        if (condition === "invalid-framework-json")
          await write("diagnostics/framework.json", "PRIVATE_INVALID_JSON");
        const result = await measureWebBundles({ buildDir, buildComplete: true });
        expect(result.status).toBe("incomplete");
        expect(result.coverage.measured).toBe(0);
        expect(JSON.stringify(result)).not.toContain("PRIVATE_INVALID_JSON");
      });
    },
  );

  it("reports actual raw/gzip bytes with per-route and all-route deduplication", async () => {
    await fixture(async ({ buildDir, write }) => {
      await write("static/chunks/dashboard.js", "const dashboard = 'page';");
      await write(
        "server/app/dashboard.html",
        tags(
          '<script src="/_next/static/chunks/dashboard.js"></script><script src="/_next/static/chunks/shared.js"></script>',
        ),
      );
      const js = await readFile(join(buildDir, "static/chunks/shared.js"));
      const css = await readFile(join(buildDir, "static/css/shared.css"));
      const local = await readFile(join(buildDir, "static/chunks/dashboard.js"));
      const result = await measureWebBundles({ buildDir, buildComplete: true });
      expect(result.status).toBe("passed");
      expect(result.coverage).toEqual({ expected: 7, measured: 7 });
      expect(result.routes.map((entry) => entry.route)).toEqual(STUDY_ROUTES);
      expect(result.totalDistinct.js).toEqual({
        assets: 2,
        rawB: js.length + local.length,
        gzipB: gzipSync(js, { level: 9 }).length + gzipSync(local, { level: 9 }).length,
      });
      expect(result.totalDistinct.css).toEqual({
        assets: 1,
        rawB: css.length,
        gzipB: gzipSync(css, { level: 9 }).length,
      });
      const dashboard = result.routes[0];
      expect(dashboard).toMatchObject({
        initial: { js: result.totalDistinct.js },
        shared: { js: { assets: 1, rawB: js.length } },
      });
      expect(result.sharedDistinct.js.assets).toBe(1);
      expect(JSON.stringify(result)).not.toContain(buildDir);
      expect(JSON.stringify(result)).not.toContain("Private body");
      expect(JSON.stringify(result)).not.toContain("globalThis.example");
      expect(JSON.stringify(result)).not.toContain("static/chunks");
    });
  });

  it("reports missing dynamic-route HTML as incomplete, never a passing full baseline", async () => {
    await fixture(async ({ buildDir }) => {
      await rm(join(buildDir, "server/app/items/[id].html"));
      const result = await measureWebBundles({ buildDir, buildComplete: true });
      expect(result.status).toBe("incomplete");
      expect(result.coverage).toEqual({ expected: 7, measured: 6 });
      expect(result.routes[3]).toEqual({
        route: "/items/[id]",
        status: "unavailable",
        code: "UNAVAILABLE_FILE",
      });
      expect(await main(["--build-complete", "--build-dir", buildDir], () => {})).toBe(2);
    });
  });

  it("accepts an explicitly supplied local HTML capture directory, not arbitrary route filenames", async () => {
    await fixture(async ({ root, buildDir }) => {
      const htmlDir = join(root, "captured-html");
      for (const route of STUDY_ROUTES) {
        const file = join(htmlDir, `${route.slice(1)}.html`);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, tags());
      }
      await rm(join(buildDir, "server/app"), { recursive: true });
      expect((await measureWebBundles({ buildDir, htmlDir, buildComplete: true })).status).toBe(
        "passed",
      );
    });
  });

  it("fails if any referenced file is missing, and does not invent bytes from unrelated manifests", async () => {
    await fixture(async ({ buildDir, write }) => {
      await write(
        "server/app/dashboard.html",
        tags('<script src="/_next/static/chunks/missing.js"></script>'),
      );
      await write(
        "server/app/dashboard/page_client-reference-manifest.js",
        "throw new Error('must never execute');",
      );
      const result = await measureWebBundles({ buildDir, buildComplete: true });
      expect(result.status).toBe("incomplete");
      expect(result.routes[0]).toMatchObject({ status: "unavailable", code: "UNAVAILABLE_FILE" });
    });
  });

  it("rejects symlink/junction escapes without reading or reporting outside asset content", async () => {
    await fixture(async ({ root, buildDir, write }) => {
      const outside = join(root, "outside");
      await mkdir(outside);
      await writeFile(join(outside, "private.js"), "SECRET_TOKEN_DO_NOT_REPORT");
      await symlink(
        outside,
        join(buildDir, "static/chunks/redirect"),
        process.platform === "win32" ? "junction" : "dir",
      );
      await write(
        "server/app/dashboard.html",
        tags('<script src="/_next/static/chunks/redirect/private.js"></script>'),
      );
      const result = await measureWebBundles({ buildDir, buildComplete: true });
      expect(result.status).toBe("incomplete");
      expect(result.routes[0]).toMatchObject({ code: "UNSAFE_FILE_LINK" });
      expect(JSON.stringify(result)).not.toContain("SECRET_TOKEN");
      expect(JSON.stringify(result)).not.toContain(outside);
    });
  });

  it("exits nonzero when an initial route exceeds a provisional budget, even with excellent compression", async () => {
    await fixture(async ({ buildDir, write }) => {
      await write("static/chunks/shared.js", "a".repeat(STARTING_BUDGETS.route.js.rawB + 1));
      const result = await measureWebBundles({ buildDir, buildComplete: true });
      expect(result.status).toBe("exceeded");
      expect(result.excess).toContainEqual({
        scope: "/dashboard",
        kind: "js",
        unit: "rawB",
        actual: STARTING_BUDGETS.route.js.rawB + 1,
        budget: STARTING_BUDGETS.route.js.rawB,
      });
      expect(await main(["--build-complete", "--build-dir", buildDir], () => {})).toBe(1);
    });
  });

  it("checks distinct totals as well as each route budget", async () => {
    await fixture(async ({ buildDir, write }) => {
      for (const [index, route] of STUDY_ROUTES.entries()) {
        await write(`static/chunks/route-${index}.js`, "a".repeat(700_000));
        await write(
          `server/app${route}.html`,
          tags(`<script src="/_next/static/chunks/route-${index}.js"></script>`),
        );
      }
      const result = await measureWebBundles({ buildDir, buildComplete: true });
      expect(result.status).toBe("exceeded");
      expect(
        result.excess.some(
          (entry) =>
            entry.scope === "totalDistinct" && entry.kind === "js" && entry.unit === "rawB",
        ),
      ).toBe(true);
      expect(result.excess.every((entry) => entry.scope === "totalDistinct")).toBe(true);
    });
  });

  it("rejects oversized/empty HTML or assets instead of silently dropping them", async () => {
    await fixture(async ({ buildDir, write }) => {
      await write("server/app/dashboard.html", "x".repeat(4 * 1024 * 1024 + 1));
      await write("static/chunks/shared.js", "");
      const result = await measureWebBundles({ buildDir, buildComplete: true });
      expect(result.status).toBe("incomplete");
      expect(result.routes[0]).toMatchObject({ code: "INVALID_FILE_SIZE" });
      expect(result.routes[1]).toMatchObject({ code: "INVALID_FILE_SIZE" });
    });
  });
});

describe("CLI argument and output safety", () => {
  it("accepts only directory selection, with all seven routes fixed", () => {
    expect(parseArgs([])).toEqual({});
    expect(parseArgs(["--build-dir", "/tmp/build", "--html-dir", "/tmp/html"])).toEqual({
      buildDir: "/tmp/build",
      htmlDir: "/tmp/html",
    });
    expect(parseArgs(["--build-complete"])).toEqual({ buildComplete: true });
  });

  it.each([
    ["--route", "/admin"],
    ["--output", "private.json"],
    ["--build-dir"],
    ["--html-dir", ""],
    ["--build-dir", "a", "--build-dir", "b"],
    ["--html-dir", "a", "--html-dir", "b"],
    ["--html-dir", "--build-dir"],
    ["--build-complete", "--build-complete"],
  ])("rejects unsafe or repeated arguments before any measurement: %j", async (args) => {
    expect(() => parseArgs(args)).toThrow("INVALID_ARGUMENTS");
    const reports: string[] = [];
    expect(
      await main(args, (text) => {
        reports.push(text);
      }),
    ).toBe(2);
    expect(reports).toEqual(['{"status":"incomplete","code":"INVALID_ARGUMENTS"}']);
  });

  it("does not leak a missing root path or native filesystem error details", async () => {
    const reports: string[] = [];
    expect(
      await main(["--build-dir", "/PRIVATE_NOT_A_BUILD_TOKEN"], (text) => {
        reports.push(text);
      }),
    ).toBe(2);
    expect(reports[0]).not.toContain("PRIVATE_NOT_A_BUILD_TOKEN");
    expect(reports[0]).not.toContain("ENOENT");
  });
});
