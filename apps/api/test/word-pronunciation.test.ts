import { describe, expect, it } from "vitest";
import { PRONUNCIATION_RECORDINGS } from "@kanji-srs/shared";
import { toVerifiedWordPronunciation } from "../src/audio/word-pronunciation";

describe("exact verified sidecar pronunciation", () => {
  const entry = PRONUNCIATION_RECORDINGS[0];
  const asset = () => ({
    id: entry.id,
    learningItemId: "word",
    mediaUrl: `https://kanji-app-rho.vercel.app${entry.publicPath}`,
    storageKey: entry.publicPath,
    checksumSha256: entry.checksumSha256,
    durationMs: entry.durationMs,
    speakerName: entry.speaker,
    voiceMetadataJson: {
      origin: "human-recording",
      expression: entry.expression,
      reading: entry.reading,
    },
    locale: entry.locale,
    attributionText: entry.attribution,
    importRunId: "run",
    status: "PUBLISHED",
    dataSource: { name: "Lingua Libre", homepageUrl: entry.sourceUrl },
    license: { name: entry.licenseName, url: entry.licenseUrl },
    importRun: { status: "SUCCESS", checksumSha256: entry.checksumSha256 },
  });
  it("attaches only the exact word with successful published provenance", () => {
    expect(toVerifiedWordPronunciation(asset(), "word", "食べる", "たべる")).toMatchObject({
      id: entry.id,
    });
    expect(toVerifiedWordPronunciation(asset(), "other", "食べる", "たべる")).toBeNull();
    expect(toVerifiedWordPronunciation(asset(), "word", "食", "しょく")).toBeNull();
  });
  it.each(["checksum", "license", "origin", "run", "locale", "source"])(
    "rejects changed %s evidence",
    (kind) => {
      const record = asset();
      if (kind === "checksum")
        record.checksumSha256 = "0".repeat(64) as typeof record.checksumSha256;
      if (kind === "license")
        record.license.url = "https://example.test/unknown" as typeof record.license.url;
      if (kind === "origin") record.voiceMetadataJson.origin = "synthetic";
      if (kind === "run") record.importRun.status = "FAILED";
      if (kind === "locale") record.locale = "en-US" as typeof record.locale;
      if (kind === "source")
        record.dataSource.homepageUrl =
          "https://example.test/other" as typeof record.dataSource.homepageUrl;
      expect(toVerifiedWordPronunciation(record, "word", "食べる", "たべる")).toBeNull();
    },
  );
});
