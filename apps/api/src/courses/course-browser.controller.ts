import { Controller, Get, Inject, Param, Query, UseGuards, BadRequestException } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CourseBrowserService } from "./course-browser.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { type CurrentUserDto } from "../auth/auth.types";

export function requireCourseBrowserId(value: string): string {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(value))
    throw new BadRequestException("Идентификатор курса должен быть UUID.");
  return value;
}

@UseGuards(AuthGuard)
@Controller("courses")
export class CourseBrowserController {
  constructor(@Inject(CourseBrowserService) private readonly service: CourseBrowserService) {}

  @Get(":courseId/outline")
  async outline(@Param("courseId") courseId: string) {
    return this.service.outline(requireCourseBrowserId(courseId));
  }

  @Get(":courseId/levels/:level/items")
  materials(@CurrentUser() user: CurrentUserDto, @Param("courseId") courseId: string,
    @Param("level") level: string, @Query() query: { readonly page?: unknown }) {
    return this.service.materials(user.id, requireCourseBrowserId(courseId), level, query);
  }
}
