import { createHash } from "node:crypto";

export function verifyPronunciationWav(
  bytes: Buffer,
  expected: {
    readonly checksumSha256: string;
    readonly bytes: number;
    readonly durationMs: number;
    readonly riffSizeDeltaBytes?: number;
  },
): void {
  if (
    bytes.length !== expected.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== expected.checksumSha256
  )
    throw new Error("Recording byte size/checksum mismatch.");
  // This pinned original undercounts RIFF by four bytes; PCM/data sizes are intact.
  const sizeDelta = expected.riffSizeDeltaBytes ?? 0;
  if (
    ![0, 4].includes(sizeDelta) ||
    bytes.length < 44 ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WAVE" ||
    bytes.readUInt32LE(4) + 8 + sizeDelta !== bytes.length
  )
    throw new Error("Invalid WAV container.");
  let byteRate = 0;
  let dataBytes = 0;
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > bytes.length) throw new Error("Truncated WAV chunk.");
    const type = bytes.toString("ascii", offset, offset + 4);
    if (type === "fmt ") {
      if (size < 16 || bytes.readUInt16LE(start) !== 1)
        throw new Error("Expected original PCM WAV.");
      byteRate = bytes.readUInt32LE(start + 8);
    }
    if (type === "data") dataBytes += size;
    offset = start + size + (size % 2);
  }
  if (!byteRate || !dataBytes || Math.abs((dataBytes / byteRate) * 1000 - expected.durationMs) > 1)
    throw new Error("Recording duration mismatch.");
}
