import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { createReadStream as openReadStream, createWriteStream as openWriteStream } from "node:fs";
import { basename, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { createGunzip } from "node:zlib";

const SNAPSHOT_VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/iu;
const MANIFEST_SCHEMA_VERSION = 2;
const DEFAULT_KANJIVG_VERSION = "r20250816";

const DEFAULT_URLS = {
  jmdict: "https://www.edrdg.org/pub/Nihongo/JMdict.gz",
  kanjidic2: "https://www.edrdg.org/kanjidic/kanjidic2.xml.gz",
  kanjivg: "https://github.com/KanjiVG/kanjivg/releases/download/r20250816/kanjivg-20250816.xml.gz",
};

export function buildContentSources(options = {}) {
  const kanjivgVersion = options.kanjivgVersion ?? DEFAULT_KANJIVG_VERSION;
  const kanjivgRelease = kanjivgVersion.replace(/^r/u, "");
  const defaultKanjivgUrl =
    `https://github.com/KanjiVG/kanjivg/releases/download/${kanjivgVersion}/` +
    `kanjivg-${kanjivgRelease}.xml.gz`;

  return [
    {
      id: "jmdict",
      envPrefix: "JMDICT",
      name: "JMdict",
      url: options.jmdictUrl ?? DEFAULT_URLS.jmdict,
      archiveFile: "JMdict.gz",
      contentFile: "JMdict.xml",
      expectedArchiveSha256: normalizeOptionalSha256(options.expectedJmdictArchiveSha256),
    },
    {
      id: "kanjidic2",
      envPrefix: "KANJIDIC2",
      name: "KANJIDIC2",
      url: options.kanjidic2Url ?? DEFAULT_URLS.kanjidic2,
      archiveFile: "kanjidic2.xml.gz",
      contentFile: "kanjidic2.xml",
      expectedArchiveSha256: normalizeOptionalSha256(options.expectedKanjidic2ArchiveSha256),
    },
    {
      id: "kanjivg",
      envPrefix: "KANJIVG",
      name: "KanjiVG",
      url:
        options.kanjivgUrl ??
        (kanjivgVersion === DEFAULT_KANJIVG_VERSION ? DEFAULT_URLS.kanjivg : defaultKanjivgUrl),
      sourceVersion: kanjivgVersion,
      archiveFile: `kanjivg-${kanjivgRelease}.xml.gz`,
      contentFile: `kanjivg-${kanjivgRelease}.xml`,
      expectedArchiveSha256: normalizeOptionalSha256(options.expectedKanjivgArchiveSha256),
    },
  ];
}

export async function prepareContentSnapshot(options, dependencies = {}) {
  const snapshotVersion = validateSnapshotVersion(options.snapshotVersion);
  const cacheRoot = resolve(options.cacheRoot ?? ".cache/content-sources");
  const snapshotDir = join(cacheRoot, snapshotVersion);
  const manifestPath = join(snapshotDir, "manifest.json");
  const sources = options.sources ?? buildContentSources(options);
  const downloadArchive = dependencies.downloadArchive ?? downloadArchiveWithRetries;
  const now = dependencies.now ?? (() => new Date());

  await mkdir(snapshotDir, { recursive: true });
  const existingManifest = await readManifest(manifestPath, snapshotVersion);
  const preparedSources = [];
  const cacheHits = [];

  for (const source of sources) {
    const normalizedSource = {
      ...source,
      expectedArchiveSha256: normalizeOptionalSha256(source.expectedArchiveSha256),
    };
    validateSourceDefinition(normalizedSource);
    const existingSource = existingManifest?.sources.find(
      (candidate) => candidate.id === normalizedSource.id,
    );
    const prepared = await prepareSource({
      source: normalizedSource,
      existingSource,
      snapshotDir,
      downloadArchive,
      now,
    });

    preparedSources.push(prepared.manifestSource);
    cacheHits.push({ id: normalizedSource.id, reused: prepared.reused });
  }

  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    snapshotVersion,
    sources: preparedSources,
  };

  await writeJsonAtomic(manifestPath, manifest);

  if (options.githubEnvPath !== undefined) {
    await appendGithubEnvironment(options.githubEnvPath, snapshotDir, sources, preparedSources);
  }

  return { snapshotDir, manifestPath, manifest, cacheHits };
}

async function prepareSource({ source, existingSource, snapshotDir, downloadArchive, now }) {
  const archivePath = join(snapshotDir, source.archiveFile);
  const contentPath = join(snapshotDir, source.contentFile);
  let archiveSha256 = await hashFileIfPresent(archivePath);
  let downloadedAt = existingSource?.downloadedAt ?? null;
  let reusedArchive = archiveSha256 !== null;

  const cacheMetadataMatches =
    existingSource === undefined ||
    (existingSource.url === source.url &&
      existingSource.archiveFile === source.archiveFile &&
      existingSource.archiveSha256 === archiveSha256);
  const expectedChecksumMatches =
    source.expectedArchiveSha256 === null || source.expectedArchiveSha256 === archiveSha256;

  if (!cacheMetadataMatches || !expectedChecksumMatches || archiveSha256 === null) {
    archiveSha256 = await downloadAndReplaceArchive(source, archivePath, downloadArchive);
    downloadedAt = now().toISOString();
    reusedArchive = false;
  } else if (downloadedAt === null) {
    downloadedAt = (await stat(archivePath)).mtime.toISOString();
  }

  let contentSha256 = await hashFileIfPresent(contentPath);
  let reusedContent =
    reusedArchive &&
    existingSource !== undefined &&
    existingSource.archiveSha256 === archiveSha256 &&
    existingSource.contentSha256 === contentSha256;

  if (!reusedContent) {
    try {
      await decompressGzipAtomic(archivePath, contentPath);
    } catch (error) {
      if (!reusedArchive) {
        throw error;
      }

      archiveSha256 = await downloadAndReplaceArchive(source, archivePath, downloadArchive);
      downloadedAt = now().toISOString();
      reusedArchive = false;
      await decompressGzipAtomic(archivePath, contentPath);
    }

    contentSha256 = await hashFile(contentPath);
    reusedContent = false;
  }

  return {
    reused: reusedArchive && reusedContent,
    manifestSource: {
      id: source.id,
      name: source.name,
      url: source.url,
      ...(source.sourceVersion === undefined ? {} : { sourceVersion: source.sourceVersion }),
      downloadedAt,
      archiveFile: source.archiveFile,
      contentFile: source.contentFile,
      archiveSha256,
      contentSha256,
    },
  };
}

async function downloadAndReplaceArchive(source, archivePath, downloadArchive) {
  const temporaryPath = temporarySiblingPath(archivePath);

  try {
    await downloadArchive(source.url, temporaryPath);
    const archiveSha256 = await hashFile(temporaryPath);

    if (source.expectedArchiveSha256 !== null && archiveSha256 !== source.expectedArchiveSha256) {
      throw new Error(
        `SHA-256 mismatch for ${source.archiveFile}: expected ${source.expectedArchiveSha256}, received ${archiveSha256}.`,
      );
    }

    await replaceFile(temporaryPath, archivePath);
    return archiveSha256;
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

async function decompressGzipAtomic(archivePath, contentPath) {
  const temporaryPath = temporarySiblingPath(contentPath);

  try {
    await pipeline(
      openReadStream(archivePath),
      createGunzip(),
      openWriteStream(temporaryPath, { flags: "wx" }),
    );
    await replaceFile(temporaryPath, contentPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

async function replaceFile(sourcePath, destinationPath) {
  await rm(destinationPath, { force: true });
  await rename(sourcePath, destinationPath);
}

async function downloadArchiveWithRetries(url, destinationPath) {
  let lastError;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "kanji-srs-content-snapshot/1.0" },
        signal: globalThis.AbortSignal.timeout(10 * 60 * 1000),
      });

      if (!response.ok || response.body === null) {
        throw new Error(`Download failed with HTTP ${response.status} for ${url}.`);
      }

      await pipeline(
        Readable.fromWeb(response.body),
        openWriteStream(destinationPath, { flags: "wx" }),
      );
      return;
    } catch (error) {
      lastError = error;
      await rm(destinationPath, { force: true });

      if (attempt < 5) {
        await delay(attempt * 1000);
      }
    }
  }

  throw new Error(`Unable to download ${url} after 5 attempts.`, { cause: lastError });
}

async function appendGithubEnvironment(environmentPath, snapshotDir, sources, manifestSources) {
  const lines = [`SNAPSHOT_DIR=${snapshotDir}`];

  for (const source of sources) {
    const prepared = manifestSources.find((candidate) => candidate.id === source.id);

    if (prepared === undefined) {
      throw new Error(`Prepared source ${source.id} is missing from the manifest.`);
    }

    lines.push(
      `${source.envPrefix}_SOURCE_DOWNLOADED_AT=${prepared.downloadedAt}`,
      `${source.envPrefix}_ARCHIVE_SHA256=${prepared.archiveSha256}`,
      `${source.envPrefix}_CONTENT_SHA256=${prepared.contentSha256}`,
      `${source.envPrefix}_CONTENT_PATH=${join(snapshotDir, prepared.contentFile)}`,
    );
  }

  await appendFile(environmentPath, `${lines.join("\n")}\n`, "utf8");
}

async function readManifest(manifestPath, snapshotVersion) {
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

    if (
      manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION ||
      manifest.snapshotVersion !== snapshotVersion ||
      !Array.isArray(manifest.sources)
    ) {
      return null;
    }

    return manifest;
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) {
      return null;
    }

    throw error;
  }
}

async function writeJsonAtomic(filePath, value) {
  const temporaryPath = temporarySiblingPath(filePath);

  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await replaceFile(temporaryPath, filePath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

async function hashFileIfPresent(filePath) {
  try {
    return await hashFile(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function hashFile(filePath) {
  const hash = createHash("sha256");

  for await (const chunk of openReadStream(filePath)) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

function temporarySiblingPath(filePath) {
  return `${filePath}.${process.pid}.${randomUUID()}.tmp`;
}

function normalizeOptionalSha256(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (!SHA256_PATTERN.test(value)) {
    throw new Error("Expected checksums must contain exactly 64 hexadecimal characters.");
  }

  return value.toLowerCase();
}

function validateSnapshotVersion(value) {
  if (!SNAPSHOT_VERSION_PATTERN.test(value ?? "")) {
    throw new Error("--snapshot-version must use YYYY-MM-DD format.");
  }

  return value;
}

function validateSourceDefinition(source) {
  for (const field of ["id", "envPrefix", "name", "url", "archiveFile", "contentFile"]) {
    if (typeof source[field] !== "string" || source[field].length === 0) {
      throw new Error(`Content source field ${field} is required.`);
    }
  }

  if (
    basename(source.archiveFile) !== source.archiveFile ||
    basename(source.contentFile) !== source.contentFile
  ) {
    throw new Error(`Content source ${source.id} filenames must not contain directories.`);
  }
}

function parseArguments(args) {
  const values = new Map();

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const value = args[index + 1];

    if (!flag.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new Error(`Expected a value after ${flag}.`);
    }

    values.set(flag, value);
    index += 1;
  }

  const knownFlags = new Set([
    "--snapshot-version",
    "--cache-root",
    "--github-env",
    "--jmdict-url",
    "--kanjidic2-url",
    "--kanjivg-url",
    "--kanjivg-version",
    "--expected-jmdict-archive-sha256",
    "--expected-kanjidic2-archive-sha256",
    "--expected-kanjivg-archive-sha256",
  ]);

  for (const flag of values.keys()) {
    if (!knownFlags.has(flag)) {
      throw new Error(`Unknown option ${flag}.`);
    }
  }

  return {
    snapshotVersion: values.get("--snapshot-version"),
    cacheRoot: values.get("--cache-root"),
    githubEnvPath: values.get("--github-env"),
    jmdictUrl: values.get("--jmdict-url"),
    kanjidic2Url: values.get("--kanjidic2-url"),
    kanjivgUrl: values.get("--kanjivg-url"),
    kanjivgVersion: values.get("--kanjivg-version"),
    expectedJmdictArchiveSha256: values.get("--expected-jmdict-archive-sha256"),
    expectedKanjidic2ArchiveSha256: values.get("--expected-kanjidic2-archive-sha256"),
    expectedKanjivgArchiveSha256: values.get("--expected-kanjivg-archive-sha256"),
  };
}

async function runCli() {
  const options = parseArguments(process.argv.slice(2));
  const result = await prepareContentSnapshot(options);

  process.stdout.write(
    `${JSON.stringify({
      snapshotDir: result.snapshotDir,
      manifestPath: result.manifestPath,
      cacheHits: result.cacheHits,
    })}\n`,
  );
}

const invokedPath =
  process.argv[1] === undefined ? null : pathToFileURL(resolve(process.argv[1])).href;

if (invokedPath === import.meta.url) {
  runCli().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
