import { Body, Controller, Get, Inject, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { type CurrentUserDto, type RequestWithCurrentUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { timedQueueRead, type TimingResponse } from "../http/queue-timing";
import { LessonsService } from "./lessons.service";

@UseGuards(AuthGuard)
@Controller("lessons")
export class LessonsController {
  constructor(@Inject(LessonsService) private readonly lessonsService: LessonsService) {}

  @Get("queue")
  getQueue(
    @CurrentUser() currentUser: CurrentUserDto,
    @Query("deckId") deckId?: string,
    @Req() request?: RequestWithCurrentUser,
    @Res({ passthrough: true }) response?: TimingResponse,
  ) {
    return timedQueueRead("lessons", () => this.lessonsService.getQueue(currentUser, deckId), response, request?.authDurationMs);
  }

  @Get("active")
  getActiveSession(@CurrentUser() currentUser: CurrentUserDto) {
    return this.lessonsService.getActiveSession(currentUser);
  }

  @Post("start")
  startSession(@CurrentUser() currentUser: CurrentUserDto, @Body() body: unknown) {
    return this.lessonsService.startSession(currentUser, body);
  }

  @Post(":sessionId/complete-item")
  completeItem(
    @Param("sessionId") sessionId: string,
    @CurrentUser() currentUser: CurrentUserDto,
    @Body() body: unknown,
  ) {
    return this.lessonsService.completeItem(sessionId, currentUser, body);
  }

  @Post(":sessionId/check-answer")
  checkAnswer(
    @Param("sessionId") sessionId: string,
    @CurrentUser() currentUser: CurrentUserDto,
    @Body() body: unknown,
  ) {
    return this.lessonsService.checkAnswer(sessionId, currentUser, body);
  }

  @Post(":sessionId/progress")
  updateProgress(
    @Param("sessionId") sessionId: string,
    @CurrentUser() currentUser: CurrentUserDto,
    @Body() body: unknown,
  ) {
    return this.lessonsService.updateProgress(sessionId, currentUser, body);
  }

  @Post(":sessionId/finish")
  finishSession(@Param("sessionId") sessionId: string, @CurrentUser() currentUser: CurrentUserDto) {
    return this.lessonsService.finishSession(sessionId, currentUser);
  }

  @Post(":sessionId/abandon")
  abandonSession(
    @Param("sessionId") sessionId: string,
    @CurrentUser() currentUser: CurrentUserDto,
  ) {
    return this.lessonsService.abandonSession(sessionId, currentUser);
  }
}
