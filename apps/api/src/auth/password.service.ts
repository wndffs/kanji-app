import {
  randomBytes,
  scrypt as scryptCallback,
  type ScryptOptions,
  timingSafeEqual,
} from "node:crypto";

import { Injectable } from "@nestjs/common";

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  N: 16_384,
  r: 8,
  p: 1,
} as const;

@Injectable()
export class PasswordService {
  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await deriveScryptKey(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);

    return [
      "scrypt",
      "v1",
      SCRYPT_OPTIONS.N,
      SCRYPT_OPTIONS.r,
      SCRYPT_OPTIONS.p,
      salt.toString("base64url"),
      key.toString("base64url"),
    ].join("$");
  }

  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const parsed = parsePasswordHash(storedHash);

    if (parsed === null) {
      return false;
    }

    const expected = await deriveScryptKey(password, parsed.salt, parsed.key.length, {
      N: parsed.n,
      r: parsed.r,
      p: parsed.p,
    });

    return expected.length === parsed.key.length && timingSafeEqual(expected, parsed.key);
  }
}

function deriveScryptKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error !== null) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

function parsePasswordHash(hash: string): {
  readonly n: number;
  readonly r: number;
  readonly p: number;
  readonly salt: Buffer;
  readonly key: Buffer;
} | null {
  const [algorithm, version, n, r, p, salt, key] = hash.split("$");

  if (algorithm !== "scrypt" || version !== "v1" || !n || !r || !p || !salt || !key) {
    return null;
  }

  const parsedN = Number(n);
  const parsedR = Number(r);
  const parsedP = Number(p);

  if (
    !Number.isInteger(parsedN) ||
    !Number.isInteger(parsedR) ||
    !Number.isInteger(parsedP) ||
    parsedN < 1 ||
    parsedR < 1 ||
    parsedP < 1
  ) {
    return null;
  }

  const parsedSalt = Buffer.from(salt, "base64url");
  const parsedKey = Buffer.from(key, "base64url");

  if (parsedSalt.length === 0 || parsedKey.length === 0) {
    return null;
  }

  return {
    n: parsedN,
    r: parsedR,
    p: parsedP,
    salt: parsedSalt,
    key: parsedKey,
  };
}
