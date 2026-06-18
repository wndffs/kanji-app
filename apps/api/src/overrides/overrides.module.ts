import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { OverridesController } from "./overrides.controller";
import { OverridesRepository, PrismaOverridesRepository } from "./overrides.repository";
import { OverridesService } from "./overrides.service";

@Module({
  imports: [AuthModule],
  controllers: [OverridesController],
  providers: [
    OverridesService,
    {
      provide: OverridesRepository,
      useClass: PrismaOverridesRepository,
    },
  ],
  exports: [OverridesService],
})
export class OverridesModule {}
