import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { CoursesController } from "./courses.controller";
import { CoursesRepository, PrismaCoursesRepository } from "./courses.repository";
import { CoursesService } from "./courses.service";
import { CourseBrowserController } from "./course-browser.controller";
import { CourseBrowserRepository } from "./course-browser.repository";
import { CourseBrowserService } from "./course-browser.service";
import { LessonsModule } from "../lessons/lessons.module";

@Module({
  imports: [AuthModule, LessonsModule],
  controllers: [CoursesController, CourseBrowserController],
  providers: [
    CoursesService,
    CourseBrowserRepository,
    CourseBrowserService,
    {
      provide: CoursesRepository,
      useClass: PrismaCoursesRepository,
    },
  ],
})
export class CoursesModule {}
