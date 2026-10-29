import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { type CurrentUserDto, type RequestWithCurrentUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { timedQueueRead, type TimingResponse } from "../http/queue-timing";
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
  getQueue(
    @CurrentUser() currentUser: CurrentUserDto,
    @Req() request?: RequestWithCurrentUser,
    @Res({ passthrough: true }) response?: TimingResponse,
  ) {
    return timedQueueRead(
      "reviews",
      () => this.reviewsService.getQueue(currentUser),
      response,
      request?.authDurationMs,
    );
  }

  @Post("start")
  startSession(@CurrentUser() currentUser: CurrentUserDto) {
    return this.reviewsService.startSession(currentUser);
  }

  @Get("active")
  getActiveSession(@CurrentUser() currentUser: CurrentUserDto) {
    return this.reviewsService.getActiveSession(currentUser);
  }

  @Post(":sessionId/correction")
  submitCorrection(
    @Param("sessionId") sessionId: string,
    @CurrentUser() currentUser: CurrentUserDto,
    @Body() body: unknown,
  ) {
    this.rateLimitService.assertAllowed("review-answer-user", currentUser.id);
    return this.reviewsService.submitCorrection(sessionId, currentUser, body);
  }

  @Get("practice/queue")
  getPracticeQueue(
    @CurrentUser() currentUser: CurrentUserDto,
    @Query("source") source: string | undefined,
  ) {
    return this.reviewsService.getPracticeQueue(currentUser, source);
  }

  @Get("practice/active")
  getActivePracticeSession(
    @CurrentUser() currentUser: CurrentUserDto,
    @Query("source") source: string | undefined,
  ) {
    return this.reviewsService.getActivePracticeSession(currentUser, source);
  }

  @Get("practice/history")
  getPracticeHistory(@CurrentUser() currentUser:CurrentUserDto,@Query("source") source:string|undefined) {
    return this.reviewsService.getPracticeHistory(currentUser,source);
  }

  @Post("practice/start")
  startPracticeSession(@CurrentUser() currentUser: CurrentUserDto, @Body() body: unknown) {
    return this.reviewsService.startPracticeSession(currentUser, body);
  }

  @Post("practice/:sessionId/answer")
  async submitPracticeAnswer(
    @Param("sessionId") sessionId: string,
    @CurrentUser() currentUser: CurrentUserDto,
    @Body() body: unknown,
  ) {
    this.rateLimitService.assertAllowed("review-answer-user", currentUser.id);

    return await this.reviewsService.submitPracticeAnswer(sessionId, currentUser, body);
  }

  @Post("practice/:sessionId/finish")
  finishPracticeSession(
    @Param("sessionId") sessionId: string,
    @CurrentUser() currentUser: CurrentUserDto,
  ) {
    return this.reviewsService.finishPracticeSession(sessionId, currentUser);
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
