import { Body, Controller, Get, Inject, Patch, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { AuthService } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { type CurrentUserDto, type UserSettingsDto } from "../auth/auth.types";

@UseGuards(AuthGuard)
@Controller("users")
export class UsersController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Get("me")
  getCurrentUser(@CurrentUser() user: CurrentUserDto): CurrentUserDto {
    return user;
  }

  @Get("settings")
  getSettings(@CurrentUser() user: CurrentUserDto): UserSettingsDto {
    return user.settings;
  }

  @Patch("settings")
  updateSettings(
    @CurrentUser() user: CurrentUserDto,
    @Body() body: unknown,
  ): Promise<CurrentUserDto> {
    return this.authService.updateSettings(user, body);
  }

  @Patch("settings/vacation")
  setVacationMode(@CurrentUser() user: CurrentUserDto, @Body() body: unknown) {
    return this.authService.setVacationMode(user, body);
  }
}
