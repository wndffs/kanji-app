import { createHmac, timingSafeEqual } from "node:crypto";

import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service";
import { type CurrentUserDto, type TokenPayload } from "./auth.types";

@Injectable()
export class TokenService {
  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}

  createSessionToken(user: CurrentUserDto): { readonly token: string; readonly expiresAt: Date } {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiresAtSeconds = nowSeconds + this.config.authSessionTtlMinutes * 60;
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: nowSeconds,
      exp: expiresAtSeconds,
    };
    const encodedPayload = encodeJson(payload);
    const signature = sign(encodedPayload, this.config.authTokenSecret);

    return {
      token: `${encodedPayload}.${signature}`,
      expiresAt: new Date(expiresAtSeconds * 1000),
    };
  }

  verifySessionToken(token: string): TokenPayload {
    const parts = token.split(".");

    if (parts.length !== 2) {
      throw new UnauthorizedException("Invalid token.");
    }

    const [encodedPayload, signature] = parts;

    if (!encodedPayload || !signature) {
      throw new UnauthorizedException("Invalid token.");
    }

    const expectedSignature = sign(encodedPayload, this.config.authTokenSecret);

    if (!safeEqual(signature, expectedSignature)) {
      throw new UnauthorizedException("Invalid token.");
    }

    const payload = decodeJson(encodedPayload);
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (payload.exp <= nowSeconds) {
      throw new UnauthorizedException("Session expired.");
    }

    return payload;
  }
}

function encodeJson(payload: TokenPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeJson(encodedPayload: string): TokenPayload {
  let value: unknown;

  try {
    value = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as unknown;
  } catch {
    throw new UnauthorizedException("Invalid token.");
  }

  if (!isTokenPayload(value)) {
    throw new UnauthorizedException("Invalid token.");
  }

  return value;
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isTokenPayload(value: unknown): value is TokenPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as TokenPayload).sub === "string" &&
    typeof (value as TokenPayload).email === "string" &&
    ((value as TokenPayload).role === "USER" || (value as TokenPayload).role === "ADMIN") &&
    typeof (value as TokenPayload).iat === "number" &&
    typeof (value as TokenPayload).exp === "number"
  );
}
