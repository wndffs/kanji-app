import { findPronunciationRecording, recordingOrigin } from "@kanji-srs/shared";
import { isEligibleListeningAudio, toAudioAssetDto, type AudioAssetRecord } from "./audio-asset";

export function toVerifiedWordPronunciation(asset: (AudioAssetRecord & { readonly importRun: { readonly status: string; readonly checksumSha256: string } | null }) | null, itemId: string, expression: string, reading: string | null) {
  const expected = findPronunciationRecording(expression, reading);
  if (!expected || !asset || !isEligibleListeningAudio(asset,itemId,"word")) return null;
  const metadata = asset.voiceMetadataJson as Record<string, unknown> | null;
  if (asset.id !== expected.id || asset.checksumSha256 !== expected.checksumSha256 ||
      asset.durationMs !== expected.durationMs || asset.locale !== expected.locale ||
      asset.mediaUrl !== `https://kanji-app-rho.vercel.app${expected.publicPath}` ||
      asset.speakerName !== expected.speaker || asset.attributionText !== expected.attribution ||
      asset.license.url !== expected.licenseUrl || asset.dataSource.homepageUrl !== expected.sourceUrl ||
      asset.importRun?.status !== "SUCCESS" || asset.importRun.checksumSha256 !== expected.checksumSha256 ||
      recordingOrigin(metadata) !== "human-recording" || metadata?.expression !== expression || metadata?.reading !== reading) return null;
  return toAudioAssetDto(asset);
}
