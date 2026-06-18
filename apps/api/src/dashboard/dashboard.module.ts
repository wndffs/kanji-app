import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardRepository, PrismaDashboardRepository } from "./dashboard.repository";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [AuthModule],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    {
      provide: DashboardRepository,
      useClass: PrismaDashboardRepository,
    },
  ],
})
export class DashboardModule {}
