import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { type CurrentUserDto } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { LessonsService } from "./lessons.service";

@UseGuards(AuthGuard)
@Controller("lessons")
export class LessonsController {
  constructor(@Inject(LessonsService) private readonly lessonsService: LessonsService) {}

  @Get("queue")
  getQueue(@CurrentUser() currentUser: CurrentUserDto) {
    return this.lessonsService.getQueue(currentUser);
  }

  @Post("start")
  startSession(@CurrentUser() currentUser: CurrentUserDto) {
    return this.lessonsService.startSession(currentUser);
  }

  @Post(":sessionId/complete-item")
  completeItem(
    @Param("sessionId") sessionId: string,
    @CurrentUser() currentUser: CurrentUserDto,
    @Body() body: unknown,
  ) {
    return this.lessonsService.completeItem(sessionId, currentUser, body);
  }

  @Post(":sessionId/finish")
  finishSession(@Param("sessionId") sessionId: string, @CurrentUser() currentUser: CurrentUserDto) {
    return this.lessonsService.finishSession(sessionId, currentUser);
  }
}
