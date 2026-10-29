import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import {
  SOURCE_CONTRACTS,
  verifyLocalSnapshot,
  type LocalSource,
} from "./local-source-manifest.mts";
import { scanSourceXml } from "./local-source-xml.mts";
import { inspectLocalKanji } from "./local-kanji-evidence.mts";
import { inspectLocalWords } from "./local-word-evidence.mts";
import { inspectLocalStrokes } from "./local-stroke-evidence.mts";
import {
  localCandidateFingerprint,
  summarizeLocalEvidence,
  type inspectLocalDraft,
} from "./local-draft-evidence.mts";
import { createReviewWorksheet, checkWorksheetBinding } from "./local-review-worksheet.mts";
import {
  parseLocalEvidenceArguments,
  runLocalEvidenceCli,
  writeExternalEvidence,
} from "./inspect-local-draft-sources.mts";

const directories: string[] = [];
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
async function temporary() {
  const path = await mkdtemp(join(tmpdir(), "kanji-source-evidence-"));
  directories.push(path);
  return path;
}
afterEach(async () => {
  for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true });
});
async function localSource(
  xml: string,
  id: keyof typeof SOURCE_CONTRACTS = "jmdict",
): Promise<LocalSource> {
  const directory = await temporary();
  const path = join(directory, "fixture.xml");
  await writeFile(path, xml);
  return {
    id,
    path,
    url: SOURCE_CONTRACTS[id].url,
    contentSha256: hash(xml),
    archiveSha256: "a".repeat(64),
    downloadedAt: "2026-10-28T00:00:00.000Z",
    license: SOURCE_CONTRACTS[id].license,
    licenseUrl: SOURCE_CONTRACTS[id].licenseUrl,
    attribution: SOURCE_CONTRACTS[id].attribution,
  };
}
async function snapshot() {
  const directory = await temporary();
  const sources = [];
  for (const [id, source] of Object.entries(SOURCE_CONTRACTS)) {
    const xml = "<fixture/>";
    const archive = gzipSync(xml);
    await writeFile(join(directory, source.contentFile), xml);
    await writeFile(join(directory, source.archiveFile), archive);
    sources.push({
      id,
      ...source,
      archiveSha256: hash(archive),
      contentSha256: hash(xml),
      downloadedAt: "2026-10-28T00:00:00.000Z",
    });
  }
  const manifest = { schemaVersion: 2, snapshotVersion: "2026-10-28", sources };
  await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest));
  return { directory, manifest };
}
const kd =
  '<kanjidic2><character><literal>校</literal><codepoint><cp_value cp_type="ucs">6821</cp_value></codepoint><misc><stroke_count>10</stroke_count></misc><reading_meaning><rmgroup><reading r_type="ja_on">コウ</reading><meaning>school</meaning></rmgroup></reading_meaning></character></kanjidic2>';
const entry = (sequence = "1", restriction = "") =>
  `<entry><ent_seq>${sequence}</ent_seq><k_ele><keb>学校</keb></k_ele><k_ele><keb>学園</keb></k_ele><r_ele><reb>がっこう</reb>${restriction}</r_ele><sense><stagk>学校</stagk><gloss>school</gloss><gloss xml:lang="rus">школа</gloss><gloss xml:lang="ger">Schule</gloss></sense></entry>`;
const vg =
  '<kanjivg><kanji id="kvg:kanji_06821"><g id="kvg:StrokePaths_06821"><path id="kvg:06821-s1" d="M1 2 L3 4"/></g></kanji></kanjivg>';

describe("local snapshot integrity", () => {
  it("verifies three pinned sources, both hashes and attribution without exporting content", async () => {
    const fixture = await snapshot();
    const verified = await verifyLocalSnapshot(fixture.directory);
    expect(verified.sources).toHaveLength(3);
    expect(verified.sources.every((source) => source.attribution && source.license)).toBe(true);
    expect(JSON.stringify(verified)).not.toContain("<fixture");
  });
  it.each(["checksum", "path", "identity", "duplicate", "date"])(
    "rejects damaged %s",
    async (reason) => {
      const fixture = await snapshot();
      const source = fixture.manifest.sources[0]!;
      if (reason === "checksum") source.contentSha256 = "f".repeat(64);
      if (reason === "path") source.contentFile = "../other.xml";
      if (reason === "identity") source.url = "https://untrusted.test/source";
      if (reason === "duplicate") fixture.manifest.sources[1]!.id = source.id;
      if (reason === "date") source.downloadedAt = "not-a-date";
      await writeFile(join(fixture.directory, "manifest.json"), JSON.stringify(fixture.manifest));
      await expect(verifyLocalSnapshot(fixture.directory)).rejects.toThrow();
    },
  );
  it.each(["2026-99-99", "2026-02-30"])("rejects non-calendar snapshot %s", async (date) => {
    const fixture = await snapshot();
    fixture.manifest.snapshotVersion = date;
    await writeFile(join(fixture.directory, "manifest.json"), JSON.stringify(fixture.manifest));
    await expect(verifyLocalSnapshot(fixture.directory)).rejects.toThrow("manifest contract");
  });
  it("rejects repository-local snapshots and external report overwrites", async () => {
    await expect(verifyLocalSnapshot(process.cwd())).rejects.toThrow("outside the repository");
    await expect(writeExternalEvidence(resolve("forbidden-evidence.json"), {})).rejects.toThrow(
      "outside the repository",
    );
    const path = join(await temporary(), "report.json");
    await writeExternalEvidence(path, { aggregate: 1 });
    await expect(writeExternalEvidence(path, { aggregate: 2 })).rejects.toThrow();
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ aggregate: 1 });
  });
});
describe("bounded streaming source evidence", () => {
  it("opts in to lexical source metadata without changing the old evidence projection", async () => {
    const source = await localSource(`<JMdict>${entry("1", "<re_restr>学校</re_restr>")}</JMdict>`);
    const pairs = [{expression:"学校",reading:"がっこう"}];
    const plain = await inspectLocalWords(source,pairs);
    expect(plain.items[0]).not.toHaveProperty("lexical");
    const observed = await inspectLocalWords(source,pairs,{includeLexicalMetadata:true});
    expect(observed.items[0]!.lexical).toMatchObject({commonnessRank:null});
    expect(observed.items[0]!.lexical!.senses.length).toBeGreaterThan(0);
    const ambiguous = await localSource(`<JMdict>${entry("1")}${entry("2")}</JMdict>`);
    expect((await inspectLocalWords(ambiguous,pairs,{includeLexicalMetadata:true})).items[0]).not.toHaveProperty("lexical");
  });
  it("attests an exact kanji reading but rejects inferred source type or reading", async () => {
    const source = await localSource(kd, "kanjidic2");
    const reading = { primary: "こう", source: "コウ", sourceType: "ja_on" };
    const result = await inspectLocalKanji(source, [
      { character: "校", reading },
      { character: "校", reading: { ...reading, source: "ガク" } },
      { character: "校", reading: { ...reading, sourceType: undefined } },
      { character: "学", reading },
    ]);
    expect(result.scanned).toBe(1);
    expect(result.items.map((item) => item.status)).toEqual([
      "matched",
      "reading-mismatch",
      "reading-mismatch",
      "missing",
    ]);
    expect(result.items[0]!.sourceRecordId).toBe("kanjidic2:6821");
  });
  it("respects spelling/reading restrictions and keeps bilingual evidence sense-specific", async () => {
    const source = await localSource(`<JMdict>${entry("1", "<re_restr>学校</re_restr>")}</JMdict>`);
    const result = await inspectLocalWords(source, [
      { expression: "学校", reading: "がっこう" },
      { expression: "学園", reading: "がっこう" },
      { expression: "学校", reading: "がくこう" },
    ]);
    expect(result.items.map((item) => item.status)).toEqual(["matched", "missing", "missing"]);
    expect(result.items[0]).toMatchObject({ sourceRecordId: "jmdict:1", bilingual: true });
    const unscoped = await inspectLocalWords(await localSource(`<JMdict>${entry()}</JMdict>`), [
      { expression: "学園", reading: "がっこう" },
    ]);
    expect(unscoped.items[0]).toMatchObject({ status: "matched", bilingual: false });
  });
  it("does not create cross-pairs for kana-only entries or choose among duplicate identities", async () => {
    const source = await localSource(
      "<JMdict><entry><ent_seq>1</ent_seq><r_ele><reb>ああ</reb></r_ele><r_ele><reb>あー</reb></r_ele><sense><gloss>ah</gloss></sense></entry></JMdict>",
    );
    expect(
      (await inspectLocalWords(source, [{ expression: "ああ", reading: "あー" }])).items[0]!.status,
    ).toBe("missing");
    const duplicate = await localSource(`<JMdict>${entry()}${entry("2")}</JMdict>`);
    expect(
      (await inspectLocalWords(duplicate, [{ expression: "学校", reading: "がっこう" }])).items[0],
    ).toMatchObject({ status: "ambiguous", sourceRecordId: null, sequence: null });
  });
  it("excludes kanji spellings from no-kanji readings", async () => {
    const source = await localSource(`<JMdict>${entry("1", "<re_nokanji/>")}</JMdict>`);
    expect(
      (
        await inspectLocalWords(source, [
          { expression: "学校", reading: "がっこう" },
          { expression: "がっこう", reading: "がっこう" },
        ])
      ).items.map((item) => item.status),
    ).toEqual(["missing", "matched"]);
  });
  it("matches primary graphic IDs and rejects incomplete stroke ordering", async () => {
    const result = await inspectLocalStrokes(await localSource(vg, "kanjivg"), ["校", "学"]);
    expect(result.items[0]).toMatchObject({ status: "matched", strokeCount: 1 });
    expect(result.items[1]!.status).toBe("missing");
    const variant = vg.replaceAll("06821", "06821-variant");
    expect(
      (await inspectLocalStrokes(await localSource(variant, "kanjivg"), ["校"])).items[0]!.status,
    ).toBe("missing");
    await expect(
      inspectLocalStrokes(await localSource(vg.replace("-s1", "-s2"), "kanjivg"), ["校"]),
    ).rejects.toThrow("complete primary sequence");
  });
  it("accepts bounded literal entities but never external or recursive expansion", async () => {
    const safe = await localSource(
      '<!DOCTYPE JMdict [<!ENTITY term "school">]><JMdict><entry><gloss>&term;</gloss></entry></JMdict>',
    );
    const values: string[] = [];
    await scanSourceXml(safe, "JMdict", "entry", (node) => values.push(node.children[0]!.text));
    expect(values).toEqual(["school"]);
    for (const dtd of ['<!ENTITY term SYSTEM "file:///sensitive">', '<!ENTITY term "&term;">']) {
      const source = await localSource(
        `<!DOCTYPE JMdict [${dtd}]><JMdict><entry>&term;</entry></JMdict>`,
      );
      await expect(scanSourceXml(source, "JMdict", "entry", () => {})).rejects.toThrow(
        "Unsafe source",
      );
    }
  });
  it("fails on malformed, cancelled, changed, wrong-root and oversized records", async () => {
    for (const xml of [
      "<JMdict><entry></JMdict>",
      "<wrong><entry/></wrong>",
      `<JMdict><entry>${"x".repeat(2_100_000)}</entry></JMdict>`,
    ]) {
      await expect(
        scanSourceXml(await localSource(xml), "JMdict", "entry", () => {}),
      ).rejects.toThrow();
    }
    const source = await localSource("<JMdict><entry/></JMdict>");
    await expect(
      scanSourceXml({ ...source, contentSha256: "0".repeat(64) }, "JMdict", "entry", () => {}),
    ).rejects.toThrow("changed");
    const abort = new AbortController();
    abort.abort();
    await expect(
      scanSourceXml(source, "JMdict", "entry", () => {}, abort.signal),
    ).rejects.toThrow();
  });
});
describe("aggregate and review boundaries", () => {
  it("never turns matching identities into independent approval", () => {
    const result = summarizeLocalEvidence({
      kanji: { scanned: 10, items: [{ status: "matched" }] },
      words: { scanned: 30, items: [{ status: "matched", bilingual: true }] },
      strokes: { scanned: 20, items: [{ status: "matched" }] },
    });
    expect(result).toMatchObject({
      sourceMatchesComplete: true,
      independentReview: false,
      publicationApproved: false,
      readyToPublish: false,
    });
    expect(JSON.stringify(result)).not.toMatch(/学校|reading|sourceRecordId/u);
  });
  it("binds a worksheet to exact prose, observations and source/candidate versions", () => {
    const report = {
      candidateFingerprint: localCandidateFingerprint(),
      sourceFingerprint: "f".repeat(64),
      kanji: { items: [] },
      words: { items: [] },
      strokes: { items: [] },
      summary: { sourceMatchesComplete: false },
    } as unknown as Awaited<ReturnType<typeof inspectLocalDraft>>;
    const worksheet = createReviewWorksheet(report);
    expect(checkWorksheetBinding(worksheet, report)).toMatchObject({
      bound: true,
      status: "bound-source-blocked",
      readyToPublish: false,
    });
    for (const changed of [
      { ...worksheet, sourceFingerprint: "0".repeat(64) },
      { ...worksheet, candidateFingerprint: "0".repeat(64) },
      { ...worksheet, materials: {} },
      { ...worksheet, materials: undefined },
      { ...worksheet, publicationApproved: true },
      { ...worksheet, sourceObservations: {} },
      { ...worksheet, sourceObservations: undefined },
    ]) {
      expect(checkWorksheetBinding(changed, report).bound).toBe(false);
    }
  });
  it("has a no-I/O help path and rejects unsafe or duplicate CLI arguments", async () => {
    const output: string[] = [];
    expect(await runLocalEvidenceCli(["--help"], (line) => output.push(line))).toBe(0);
    expect(output[0]).toContain("--snapshot-dir");
    for (const args of [
      [],
      ["--snapshot-dir", "relative"],
      ["--snapshot-dir", tmpdir(), "--report", "relative"],
      ["--help", "--help"],
      ["--unknown", "x"],
    ])
      expect(() => parseLocalEvidenceArguments(args)).toThrow();
  });
});
