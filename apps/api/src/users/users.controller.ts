import { Body, Controller, Get, HttpCode, Inject, Patch, Post, UseGuards } from "@nestjs/common";

import { type ReviewReminderClaimResponse } from "@kanji-srs/shared";

import { AuthGuard } from "../auth/auth.guard";
import { AuthService } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import {
  type CurrentUserDto,
  type PublicUserDto,
  type PublicUserSettingsDto,
} from "../auth/auth.types";
import { UsersRepository } from "../auth/users.repository";
import { mergeUserSettings } from "../auth/user-settings.defaults";
import { assertEmptyReminderClaimBody } from "./review-reminder-claim";

@UseGuards(AuthGuard)
@Controller("users")
export class UsersController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(UsersRepository) private readonly usersRepository: UsersRepository,
  ) {}

  @Get("me")
  getCurrentUser(@CurrentUser() user: CurrentUserDto): PublicUserDto {
    return { ...user, settings: mergeUserSettings(user.settings) };
  }

  @Get("settings")
  getSettings(@CurrentUser() user: CurrentUserDto): PublicUserSettingsDto {
    return mergeUserSettings(user.settings);
  }

  @Patch(["settings", "me/settings"])
  updateSettings(
    @CurrentUser() user: CurrentUserDto,
    @Body() body: unknown,
  ): Promise<PublicUserDto> {
    return this.authService.updateSettings(user, body);
  }

  @Post("me/review-reminders/claim")
  @HttpCode(200)
  async claimReminder(
    @CurrentUser() user: CurrentUserDto,
    @Body() body: unknown,
  ): Promise<ReviewReminderClaimResponse> {
    assertEmptyReminderClaimBody(body);
    return { shouldNotify: await this.usersRepository.claimReviewReminder(user.id, new Date()) };
  }

  @Patch("settings/vacation")
  setVacationMode(@CurrentUser() user: CurrentUserDto, @Body() body: unknown) {
    return this.authService.setVacationMode(user, body);
  }
}
