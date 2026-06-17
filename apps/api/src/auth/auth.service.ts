import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service";
import { type CurrentUserDto } from "./current-user.dto";

export type AuthLoginResponse = {
  readonly user: CurrentUserDto;
  readonly accessToken: string;
  readonly tokenType: "dev";
};

@Injectable()
export class AuthService {
  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}

  login(body: unknown): AuthLoginResponse {
    if (this.config.authMode !== "dev") {
      throw new UnauthorizedException("Локальная авторизация будет добавлена в следующей задаче.");
    }

    const user = this.getCurrentUserFromLoginBody(body);

    return {
      user,
      accessToken: `dev:${user.id}`,
      tokenType: "dev",
    };
  }

  getCurrentUser(headers: Record<string, string | string[] | undefined> = {}): CurrentUserDto {
    if (this.config.authMode !== "dev") {
      throw new UnauthorizedException("Требуется авторизация.");
    }

    const email = readHeader(headers, "x-dev-user-email") ?? this.config.devUser.email;
    const displayName = readHeader(headers, "x-dev-user-name") ?? this.config.devUser.displayName;

    return {
      ...this.config.devUser,
      email,
      displayName,
    };
  }

  private getCurrentUserFromLoginBody(body: unknown): CurrentUserDto {
    if (body === undefined || body === null) {
      return this.getCurrentUser();
    }

    if (!isRecord(body)) {
      throw new BadRequestException("Тело запроса должно быть JSON-объектом.");
    }

    const email = getOptionalString(body, "email") ?? this.config.devUser.email;
    const displayName = getOptionalString(body, "displayName") ?? this.config.devUser.displayName;

    return {
      ...this.config.devUser,
      email,
      displayName,
    };
  }
}

function readHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const value = headers[name];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];

  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new BadRequestException(`${key} must be a string.`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
