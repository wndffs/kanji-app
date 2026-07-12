import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { type CurrentUserDto } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { RateLimitService } from "../security/rate-limit.service";
import { ReviewsService } from "./reviews.service";

@UseGuards(AuthGuard)
@Controller("reviews")
export class ReviewsController {
  constructor(
    @Inject(ReviewsService) private readonly reviewsService: ReviewsService,
    @Inject(RateLimitService) private readonly rateLimitService: RateLimitService,
  ) {}

  @Get("queue")
  getQueue(@CurrentUser() currentUser: CurrentUserDto) {
    return this.reviewsService.getQueue(currentUser);
  }

  @Post("start")
  startSession(@CurrentUser() currentUser: CurrentUserDto) {
    return this.reviewsService.startSession(currentUser);
  }

  @Get("practice/queue")
  getPracticeQueue(
    @CurrentUser() currentUser: CurrentUserDto,
    @Query("source") source: string | undefined,
  ) {
    return this.reviewsService.getPracticeQueue(currentUser, source);
  }

  @Post("practice/answer")
  async submitPracticeAnswer(@CurrentUser() currentUser: CurrentUserDto, @Body() body: unknown) {
    this.rateLimitService.assertAllowed("review-answer-user", currentUser.id);

    return await this.reviewsService.submitPracticeAnswer(currentUser, body);
  }

  @Post(":sessionId/answer")
  async submitAnswer(
    @Param("sessionId") sessionId: string,
    @CurrentUser() currentUser: CurrentUserDto,
    @Body() body: unknown,
  ) {
    this.rateLimitService.assertAllowed("review-answer-user", currentUser.id);

    return await this.reviewsService.submitAnswer(sessionId, currentUser, body);
  }

  @Post(":sessionId/finish")
  finishSession(@Param("sessionId") sessionId: string, @CurrentUser() currentUser: CurrentUserDto) {
    return this.reviewsService.finishSession(sessionId, currentUser);
  }
}
