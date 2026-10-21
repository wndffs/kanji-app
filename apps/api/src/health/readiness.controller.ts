import { Controller, Get, Header, HttpStatus, Inject, Res } from "@nestjs/common";

import { ReadinessService, type ReadinessResponse } from "./readiness.service";

@Controller()
export class ReadinessController {
  constructor(@Inject(ReadinessService) private readonly readinessService: ReadinessService) {}

  @Get("ready")
  @Header("Cache-Control", "no-store")
  async getReadiness(
    @Res({ passthrough: true }) response: { status(code: number): unknown },
  ): Promise<ReadinessResponse> {
    const readiness = await this.readinessService.getReadiness();
    response.status(readiness.status === "ready" ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return readiness;
  }
}
