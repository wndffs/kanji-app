import { Controller, Get, Inject, Param, UseGuards, BadRequestException, NotFoundException } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CourseBrowserRepository } from "./course-browser.repository";

export function requireCourseBrowserId(value: string): string {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(value))
    throw new BadRequestException("Идентификатор курса должен быть UUID.");
  return value;
}

@UseGuards(AuthGuard)
@Controller("courses")
export class CourseBrowserController {
  constructor(@Inject(CourseBrowserRepository) private readonly repository: CourseBrowserRepository) {}

  @Get(":courseId/outline")
  async outline(@Param("courseId") courseId: string) {
    const outline = await this.repository.outline(requireCourseBrowserId(courseId));
    if (outline === null) throw new NotFoundException("Опубликованный курс не найден.");
    return outline;
  }
}
