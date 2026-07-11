import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { OverridesModule } from "../overrides/overrides.module";
import { LessonsController } from "./lessons.controller";
import { LessonsRepository, PrismaLessonsRepository } from "./lessons.repository";
import { LessonsService } from "./lessons.service";

@Module({
  imports: [AuthModule, OverridesModule],
  controllers: [LessonsController],
  providers: [
    LessonsService,
    {
      provide: LessonsRepository,
      useClass: PrismaLessonsRepository,
    },
  ],
})
export class LessonsModule {}
