import { calculateSha256 } from "./checksum";

export function verifySha256(content: string, expectedChecksum?: string): string {
  const checksum = calculateSha256(content);

  if (expectedChecksum === undefined) {
    return checksum;
  }

  const normalizedExpected = expectedChecksum.trim().toLowerCase();

  if (!/^[a-f0-9]{64}$/u.test(normalizedExpected)) {
    throw new Error("Expected SHA-256 checksum must contain exactly 64 hexadecimal characters.");
  }

  if (checksum !== normalizedExpected) {
    throw new Error(`SHA-256 mismatch: expected ${normalizedExpected}, received ${checksum}.`);
  }

  return checksum;
}
