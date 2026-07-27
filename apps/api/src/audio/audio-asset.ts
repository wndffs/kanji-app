import { type AdminContentStatus, type AudioAssetDto, type ItemKind } from "@kanji-srs/shared";

export type AudioAssetRecord = {
  readonly id: string;
  readonly learningItemId: string;
  readonly mediaUrl: string | null;
  readonly storageKey: string | null;
  readonly checksumSha256: string;
  readonly durationMs: number;
  readonly speakerName: string | null;
  readonly voiceMetadataJson: unknown;
  readonly locale: string;
  readonly attributionText: string;
  readonly importRunId: string | null;
  readonly status: string;
  readonly dataSource: {
    readonly name: string;
    readonly homepageUrl: string | null;
  };
  readonly license: {
    readonly name: string;
    readonly url: string | null;
  };
};

export function isEligibleListeningAudio(
  asset: AudioAssetRecord | null,
  learningItemId: string,
  itemType: ItemKind,
): asset is AudioAssetRecord {
  return (
    asset !== null &&
    (itemType === "word" || itemType === "sentence") &&
    asset.learningItemId === learningItemId &&
    asset.status === "PUBLISHED" &&
    asset.mediaUrl !== null &&
    isHttpsUrl(asset.mediaUrl) &&
    asset.durationMs > 0 &&
    /^[a-f0-9]{64}$/i.test(asset.checksumSha256) &&
    asset.attributionText.trim() !== "" &&
    asset.dataSource.name.trim() !== "" &&
    asset.license.name.trim() !== ""
  );
}

export function toAudioAssetDto(asset: AudioAssetRecord): AudioAssetDto {
  return {
    id: asset.id,
    learningItemId: asset.learningItemId,
    mediaUrl: asset.mediaUrl,
    storageKey: asset.storageKey,
    checksumSha256: asset.checksumSha256,
    durationMs: asset.durationMs,
    locale: asset.locale,
    speakerName: asset.speakerName,
    voiceMetadata: isRecord(asset.voiceMetadataJson) ? asset.voiceMetadataJson : null,
    sourceName: asset.dataSource.name,
    sourceUrl: asset.dataSource.homepageUrl,
    licenseName: asset.license.name,
    licenseUrl: asset.license.url,
    attributionText: asset.attributionText,
    importRunId: asset.importRunId,
    status: toContentStatus(asset.status),
  };
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toContentStatus(value: string): AdminContentStatus {
  switch (value) {
    case "NEEDS_REVIEW":
      return "needs-review";
    case "PUBLISHED":
      return "published";
    case "ARCHIVED":
      return "archived";
    default:
      return "draft";
  }
}
