import { Controller, Get, Inject } from "@nestjs/common";

import { HealthService } from "./health.service";
import { type HealthResponse } from "./health.service";

@Controller()
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get("health")
  getHealth(): HealthResponse {
    return this.healthService.getHealth();
  }
}
