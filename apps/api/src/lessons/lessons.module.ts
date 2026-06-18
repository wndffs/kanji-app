import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { LessonsController } from "./lessons.controller";
import { LessonsRepository, PrismaLessonsRepository } from "./lessons.repository";
import { LessonsService } from "./lessons.service";

@Module({
  imports: [AuthModule],
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
