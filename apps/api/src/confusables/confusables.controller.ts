import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { type CurrentUserDto } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { RateLimitService } from "../security/rate-limit.service";
import { ConfusablesService } from "./confusables.service";

@UseGuards(AuthGuard)
@Controller("confusables")
export class ConfusablesController {
  constructor(
    @Inject(ConfusablesService) private readonly confusablesService: ConfusablesService,
    @Inject(RateLimitService) private readonly rateLimitService: RateLimitService,
  ) {}

  @Get()
  listPairs(
    @CurrentUser() currentUser: CurrentUserDto,
    @Query("itemId") itemId: string | undefined,
  ) {
    return this.confusablesService.listPairs(currentUser, itemId);
  }

  @Get(":pairId/session")
  getActiveSession(@CurrentUser() currentUser: CurrentUserDto, @Param("pairId") pairId: string) {
    return this.confusablesService.getActiveSession(currentUser, pairId);
  }

  @Post(":pairId/session")
  startSession(@CurrentUser() currentUser: CurrentUserDto, @Param("pairId") pairId: string) {
    return this.confusablesService.startSession(currentUser, pairId);
  }

  @Post("sessions/:sessionId/answer")
  async submitAnswer(
    @CurrentUser() currentUser: CurrentUserDto,
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
  ) {
    this.rateLimitService.assertAllowed("review-answer-user", currentUser.id);

    return await this.confusablesService.submitAnswer(currentUser, sessionId, body);
  }

  @Post("sessions/:sessionId/finish")
  finishSession(@CurrentUser() currentUser: CurrentUserDto, @Param("sessionId") sessionId: string) {
    return this.confusablesService.finishSession(currentUser, sessionId);
  }

  @Post("sessions/:sessionId/abandon")
  abandonSession(
    @CurrentUser() currentUser: CurrentUserDto,
    @Param("sessionId") sessionId: string,
  ) {
    return this.confusablesService.abandonSession(currentUser, sessionId);
  }
}
