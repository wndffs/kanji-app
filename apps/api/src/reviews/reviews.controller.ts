import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { type CurrentUserDto } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { ReviewsService } from "./reviews.service";

@UseGuards(AuthGuard)
@Controller("reviews")
export class ReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviewsService: ReviewsService) {}

  @Get("queue")
  getQueue(@CurrentUser() currentUser: CurrentUserDto) {
    return this.reviewsService.getQueue(currentUser);
  }

  @Post("start")
  startSession(@CurrentUser() currentUser: CurrentUserDto) {
    return this.reviewsService.startSession(currentUser);
  }

  @Post(":sessionId/answer")
  submitAnswer(
    @Param("sessionId") sessionId: string,
    @CurrentUser() currentUser: CurrentUserDto,
    @Body() body: unknown,
  ) {
    return this.reviewsService.submitAnswer(sessionId, currentUser, body);
  }

  @Post(":sessionId/finish")
  finishSession(@Param("sessionId") sessionId: string, @CurrentUser() currentUser: CurrentUserDto) {
    return this.reviewsService.finishSession(sessionId, currentUser);
  }
}
