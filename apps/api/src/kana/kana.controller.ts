import { Body, Controller, Get, Inject, Post, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { type CurrentUserDto } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { KanaService } from "./kana.service";

@UseGuards(AuthGuard)
@Controller("kana/assessment")
export class KanaController {
  constructor(@Inject(KanaService) private readonly kanaService: KanaService) {}

  @Get()
  getProgress(@CurrentUser() user: CurrentUserDto, @Query("script") script?: string) {
    return this.kanaService.getProgress(user.id, script);
  }

  @Post("answer")
  answer(@CurrentUser() user: CurrentUserDto, @Body() body: unknown) {
    return this.kanaService.answer(user.id, body);
  }
}
