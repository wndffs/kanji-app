import { Body, Controller, Get, Inject, Patch, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { type CurrentUserDto } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { CoursesService } from "./courses.service";

@UseGuards(AuthGuard)
@Controller("courses")
export class CoursesController {
  constructor(@Inject(CoursesService) private readonly coursesService: CoursesService) {}

  @Get()
  listCourses(@CurrentUser() currentUser: CurrentUserDto) {
    return this.coursesService.listCourses(currentUser.id);
  }

  @Patch("current")
  selectCurrentCourse(@CurrentUser() currentUser: CurrentUserDto, @Body() body: unknown) {
    return this.coursesService.selectCurrentCourse(currentUser.id, body);
  }
}
