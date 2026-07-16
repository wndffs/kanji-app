import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { CoursesController } from "./courses.controller";
import { CoursesRepository, PrismaCoursesRepository } from "./courses.repository";
import { CoursesService } from "./courses.service";

@Module({
  imports: [AuthModule],
  controllers: [CoursesController],
  providers: [
    CoursesService,
    {
      provide: CoursesRepository,
      useClass: PrismaCoursesRepository,
    },
  ],
})
export class CoursesModule {}
