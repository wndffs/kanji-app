import { Controller, Get, Header, Inject } from "@nestjs/common";

import { HealthService } from "./health.service";
import { type HealthResponse } from "./health.service";

@Controller()
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get("health")
  @Header("Cache-Control", "no-store")
  getHealth(): HealthResponse {
    return this.healthService.getHealth();
  }
}
