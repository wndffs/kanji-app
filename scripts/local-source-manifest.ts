import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";

export const SOURCE_CONTRACTS = {
  jmdict: { name: "JMdict", license: "LicenseRef-JMdict-Multilingual", licenseUrl: "https://www.edrdg.org/edrdg/licence.html", attribution: "EDRDG and the credited JMdict contributors; non-English components retain their compilers' terms.", url: "https://www.edrdg.org/pub/Nihongo/JMdict.gz", archiveFile: "JMdict.gz", contentFile: "JMdict.xml" },
  kanjidic2: { name: "KANJIDIC2", license: "CC-BY-SA-4.0", licenseUrl: "https://www.edrdg.org/edrdg/licence.html", attribution: "EDRDG and the credited KANJIDIC2 contributors.", url: "https://www.edrdg.org/kanjidic/kanjidic2.xml.gz", archiveFile: "kanjidic2.xml.gz", contentFile: "kanjidic2.xml" },
  kanjivg: { name: "KanjiVG", license: "CC-BY-SA-3.0", licenseUrl: "https://kanjivg.tagaini.net/", attribution: "Ulrich Apel and the KanjiVG contributors.", url: "https://github.com/KanjiVG/kanjivg/releases/download/r20250816/kanjivg-20250816.xml.gz", archiveFile: "kanjivg-20250816.xml.gz", contentFile: "kanjivg-20250816.xml", sourceVersion: "r20250816" },
} as const;
export type SourceId = keyof typeof SOURCE_CONTRACTS;
export type LocalSource = {
  readonly id: SourceId;
  readonly path: string;
  readonly url: string;
  readonly archiveSha256: string;
  readonly contentSha256: string;
  readonly downloadedAt: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly attribution: string;
};
export type LocalSourceSnapshot = { readonly snapshotVersion: string; readonly sources: readonly LocalSource[] };
const repository = resolve(import.meta.dirname, "..");

export function isWithin(root: string, target: string): boolean {
  const path = relative(root, target);
  return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`));
}

export async function hashLocalFile(path: string, maximumBytes = 1_073_741_824): Promise<string> {
  const info = await stat(path);
  if (!info.isFile() || info.size > maximumBytes) throw new Error("Source file is not a bounded regular file.");
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(path)) {
    bytes += chunk.length;
    if (bytes > maximumBytes) throw new Error("Source file exceeds its byte budget.");
    hash.update(chunk);
  }
  return hash.digest("hex");
}

export async function verifyLocalSnapshot(directory: string): Promise<LocalSourceSnapshot> {
  const root = await realpath(directory);
  if (isWithin(await realpath(repository), root)) throw new Error("Source snapshots must stay outside the repository.");
  const manifestPath = await realpath(resolve(root, "manifest.json"));
  if (dirname(manifestPath) !== root || (await stat(manifestPath)).size > 65_536) throw new Error("Invalid source manifest path/size.");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest?.schemaVersion !== 2 || typeof manifest.snapshotVersion !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(manifest.snapshotVersion) || !Array.isArray(manifest.sources) || manifest.sources.length !== 3) throw new Error("Invalid source manifest contract.");
  const sources: LocalSource[] = [];
  for (const [id, contract] of Object.entries(SOURCE_CONTRACTS)) {
    const matches = manifest.sources.filter((source: { id?: unknown }) => source?.id === id);
    if (matches.length !== 1) throw new Error("Missing or duplicate source identity.");
    const source = matches[0];
    if (source.name !== contract.name || source.url !== contract.url || source.archiveFile !== contract.archiveFile || source.contentFile !== contract.contentFile || (id === "kanjivg" && source.sourceVersion !== SOURCE_CONTRACTS.kanjivg.sourceVersion)) throw new Error("Source identity/version does not match the pinned contract.");
    if (typeof source.downloadedAt !== "string" || !Number.isFinite(Date.parse(source.downloadedAt))) throw new Error("Missing source download date.");
    for (const [filename, checksum, limit] of [[source.archiveFile, source.archiveSha256, 268_435_456], [source.contentFile, source.contentSha256, 1_073_741_824]] as const) {
      if (typeof filename !== "string" || basename(filename) !== filename || typeof checksum !== "string" || !/^[a-f0-9]{64}$/u.test(checksum)) throw new Error("Invalid source path/checksum.");
      const path = await realpath(resolve(root, filename));
      if (dirname(path) !== root || await hashLocalFile(path, limit) !== checksum) throw new Error("Source checksum/path verification failed.");
    }
    sources.push({ id: id as SourceId, path: await realpath(resolve(root, source.contentFile)), url: contract.url, archiveSha256: source.archiveSha256, contentSha256: source.contentSha256, downloadedAt: source.downloadedAt, license: contract.license, licenseUrl: contract.licenseUrl, attribution: contract.attribution });
  }
  return { snapshotVersion: manifest.snapshotVersion, sources };
}
