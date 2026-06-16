import { Controller, Get } from "@nestjs/common";

export type HealthResponse = {
  service: "kanji-srs-api";
  status: "ok";
};

@Controller()
export class HealthController {
  @Get("health")
  getHealth(): HealthResponse {
    return {
      service: "kanji-srs-api",
      status: "ok",
    };
  }
}
