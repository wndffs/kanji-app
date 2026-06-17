import { Inject, Injectable } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service";
import { type AuthMode } from "../config/app-config.service";

export type HealthResponse = {
  readonly service: "kanji-srs-api";
  readonly status: "ok";
  readonly environment: string;
  readonly authMode: AuthMode;
};

@Injectable()
export class HealthService {
  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}

  getHealth(): HealthResponse {
    return {
      service: "kanji-srs-api",
      status: "ok",
      environment: this.config.environment,
      authMode: this.config.authMode,
    };
  }
}
