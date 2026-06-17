import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";

import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import { type AuthSessionDto, type CurrentUserDto } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() body: unknown): Promise<AuthSessionDto> {
    return this.authService.register(body);
  }

  @Post("login")
  login(@Body() body: unknown): Promise<AuthSessionDto> {
    return this.authService.login(body);
  }

  @UseGuards(AuthGuard)
  @Post("logout")
  logout(): { readonly ok: true } {
    return this.authService.logout();
  }

  @UseGuards(AuthGuard)
  @Get("me")
  getCurrentUser(@CurrentUser() user: CurrentUserDto): CurrentUserDto {
    return user;
  }
}
