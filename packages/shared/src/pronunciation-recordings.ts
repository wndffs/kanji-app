export const PRONUNCIATION_WAVE_ID = "pronunciation-445-459-v1";
export const PRONUNCIATION_RECORDINGS = [{
  id: "7326a98a-22c6-4cc1-a148-c3d321590435",
  expression: "食べる", reading: "たべる", sourceRecordId: "jmdict:1358280",
  file: "taberu-fukujinzuke.wav", publicPath: "/audio/pronunciation/taberu-fukujinzuke.wav",
  checksumSha256: "fb16170c709928802a588b176a57f9aa2f53496bd35ada1057bacbc8de5986af",
  bytes: 99116, durationMs: 1032, locale: "ja-JP", speaker: "Fukujinzuke",
  sourceUrl: "https://commons.wikimedia.org/w/index.php?oldid=1283603638&title=File%3ALL-Q5287_%28jpn%29-Fukujinzuke-%E9%A3%9F%E3%81%B9%E3%82%8B.wav",
  downloadUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a3/LL-Q5287_%28jpn%29-Fukujinzuke-%E9%A3%9F%E3%81%B9%E3%82%8B.wav",
  licenseName: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  sourceDate: "2026-10-05", verifiedAt: "2026-10-29",
  attribution: "食べる — Fukujinzuke, Lingua Libre / Wikimedia Commons, CC BY 4.0. Original recording, unmodified. Source metadata and bytes verified; not native-speaker certification.",
}] as const;

export function findPronunciationRecording(expression: string, reading: string | null) {
  return PRONUNCIATION_RECORDINGS.find(record=>record.expression === expression && record.reading === reading) ?? null;
}

export function recordingOrigin(metadata: unknown): "human-recording" | "synthetic" | "unknown" {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) return "unknown";
  const origin = (metadata as Record<string, unknown>).origin;
  return origin === "human-recording" || origin === "synthetic" ? origin : "unknown";
}
