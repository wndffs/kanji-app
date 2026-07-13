import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { afterEach, describe, expect, it } from "vitest";

import { prepareContentSnapshot } from "./prepare-content-snapshot.mjs";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("content snapshot cache", () => {
  it("downloads once and reuses verified archives and XML content", async () => {
    const cacheRoot = await createTemporaryDirectory();
    const githubEnvPath = join(cacheRoot, "github-env");
    const archives = createArchives();
    const sources = createSources(archives);
    let downloadCount = 0;
    const downloadArchive = async (url, destinationPath) => {
      downloadCount += 1;
      await writeFile(destinationPath, archives.get(url));
    };
    const now = () => new Date("2026-07-13T12:00:00.000Z");

    const first = await prepareContentSnapshot(
      { snapshotVersion: "2026-07-13", cacheRoot, githubEnvPath, sources },
      { downloadArchive, now },
    );
    const second = await prepareContentSnapshot(
      { snapshotVersion: "2026-07-13", cacheRoot, sources },
      {
        downloadArchive: async () => {
          throw new Error("The cache should avoid another download.");
        },
        now,
      },
    );

    expect(downloadCount).toBe(3);
    expect(first.cacheHits).toEqual([
      { id: "jmdict", reused: false },
      { id: "kanjidic2", reused: false },
      { id: "kanjivg", reused: false },
    ]);
    expect(second.cacheHits).toEqual([
      { id: "jmdict", reused: true },
      { id: "kanjidic2", reused: true },
      { id: "kanjivg", reused: true },
    ]);
    expect(await readFile(join(first.snapshotDir, "JMdict.xml"), "utf8")).toBe("JMdict data");
    expect(first.manifest.sources[0]).toMatchObject({
      downloadedAt: "2026-07-13T12:00:00.000Z",
      archiveSha256: sha256(archives.get("https://example.test/JMdict.gz")),
      contentSha256: sha256("JMdict data"),
    });
    expect(await readFile(githubEnvPath, "utf8")).toContain(
      `JMDICT_CONTENT_PATH=${join(first.snapshotDir, "JMdict.xml")}`,
    );
  });

  it("repairs decompressed content from a valid cached archive", async () => {
    const cacheRoot = await createTemporaryDirectory();
    const archives = createArchives();
    const sources = createSources(archives);
    const downloadArchive = async (url, destinationPath) => {
      await writeFile(destinationPath, archives.get(url));
    };
    const first = await prepareContentSnapshot(
      { snapshotVersion: "2026-07-13", cacheRoot, sources },
      { downloadArchive },
    );

    await writeFile(join(first.snapshotDir, "kanjidic2.xml"), "corrupt content");
    const second = await prepareContentSnapshot(
      { snapshotVersion: "2026-07-13", cacheRoot, sources },
      {
        downloadArchive: async () => {
          throw new Error("A valid archive should repair content without a download.");
        },
      },
    );

    expect(await readFile(join(second.snapshotDir, "kanjidic2.xml"), "utf8")).toBe(
      "KANJIDIC2 data",
    );
    expect(second.cacheHits).toContainEqual({ id: "kanjidic2", reused: false });
  });

  it("rejects a download that does not match a pinned archive checksum", async () => {
    const cacheRoot = await createTemporaryDirectory();
    const archives = createArchives();
    const sources = createSources(archives);
    sources[0].expectedArchiveSha256 = "0".repeat(64);

    await expect(
      prepareContentSnapshot(
        { snapshotVersion: "2026-07-13", cacheRoot, sources },
        {
          downloadArchive: async (url, destinationPath) => {
            await writeFile(destinationPath, archives.get(url));
          },
        },
      ),
    ).rejects.toThrow(/SHA-256 mismatch for JMdict\.gz/u);
  });
});

async function createTemporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "kanji-content-snapshot-"));
  temporaryDirectories.push(directory);
  return directory;
}

function createArchives() {
  return new Map([
    ["https://example.test/JMdict.gz", gzipSync("JMdict data")],
    ["https://example.test/kanjidic2.xml.gz", gzipSync("KANJIDIC2 data")],
    ["https://example.test/kanjivg.xml.gz", gzipSync("KanjiVG data")],
  ]);
}

function createSources(archives) {
  return [
    source("jmdict", "JMDICT", "JMdict", "JMdict.gz", "JMdict.xml", archives),
    source("kanjidic2", "KANJIDIC2", "KANJIDIC2", "kanjidic2.xml.gz", "kanjidic2.xml", archives),
    source("kanjivg", "KANJIVG", "KanjiVG", "kanjivg.xml.gz", "kanjivg.xml", archives),
  ];
}

function source(id, envPrefix, name, archiveFile, contentFile, archives) {
  const url = `https://example.test/${archiveFile}`;

  return {
    id,
    envPrefix,
    name,
    url,
    archiveFile,
    contentFile,
    expectedArchiveSha256: sha256(archives.get(url)),
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
