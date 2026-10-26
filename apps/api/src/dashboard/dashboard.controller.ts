import { Controller, Get, Inject, Req, Res, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { type CurrentUserDto, type RequestWithCurrentUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { DashboardService } from "./dashboard.service";

@UseGuards(AuthGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboard(
    @CurrentUser() currentUser: CurrentUserDto,
    @Req() request: RequestWithCurrentUser,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void },
  ) {
    const startedAt = performance.now();
    const phases: string[] = [];
    const dashboard = await this.dashboardService.getDashboard(currentUser, (phase, duration) => {
      phases.push(`${phase};dur=${Math.max(0, duration).toFixed(1)}`);
    });
    response.setHeader(
      "Server-Timing",
      [
        `auth;dur=${Math.max(0, request.authDurationMs ?? 0).toFixed(1)}`,
        ...phases,
        `dashboard;dur=${Math.max(0, performance.now() - startedAt).toFixed(1)}`,
      ].join(", "),
    );
    return dashboard;
  }
}
