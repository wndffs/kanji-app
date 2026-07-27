import {
  type AudioAssetDto,
  type CardPromptType,
  type ListeningPlaybackEvidenceDto,
} from "@kanji-srs/shared";

export function hasCompletedListeningPlayback(
  promptType: CardPromptType,
  audio: AudioAssetDto | null | undefined,
  evidence: ListeningPlaybackEvidenceDto | undefined,
): boolean {
  return (
    promptType !== "listening" ||
    (audio?.mediaUrl !== null &&
      audio?.mediaUrl !== undefined &&
      evidence?.completed === true &&
      evidence.playCount >= 1)
  );
}
