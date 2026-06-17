import { Body, Controller, Get, Headers, Inject, Post } from "@nestjs/common";

import { AuthService } from "./auth.service";
import { type CurrentUserDto } from "./current-user.dto";
import { type AuthLoginResponse } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("login")
  login(@Body() body: unknown): AuthLoginResponse {
    return this.authService.login(body);
  }

  @Post("logout")
  logout(): { readonly ok: true } {
    return { ok: true };
  }

  @Get("me")
  getCurrentUser(
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): CurrentUserDto {
    return this.authService.getCurrentUser(headers);
  }
}
