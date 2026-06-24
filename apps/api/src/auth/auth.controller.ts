import { Body, Controller, Get, Inject, Post, Req, UseGuards } from "@nestjs/common";

import {
  getClientRateLimitKey,
  getEmailRateLimitKey,
  RateLimitService,
  type RequestRateLimitSource,
} from "../security/rate-limit.service";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import { type AuthSessionDto, type CurrentUserDto } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(RateLimitService) private readonly rateLimitService: RateLimitService,
  ) {}

  @Post("register")
  async register(
    @Req() request: RequestRateLimitSource,
    @Body() body: unknown,
  ): Promise<AuthSessionDto> {
    this.limitAuthRequest("register", request, body);

    return await this.authService.register(body);
  }

  @Post("login")
  async login(
    @Req() request: RequestRateLimitSource,
    @Body() body: unknown,
  ): Promise<AuthSessionDto> {
    this.limitAuthRequest("login", request, body);

    return await this.authService.login(body);
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

  private limitAuthRequest(
    action: "login" | "register",
    request: RequestRateLimitSource,
    body: unknown,
  ): void {
    this.rateLimitService.assertAllowed(`auth-${action}-ip`, getClientRateLimitKey(request));

    const emailKey = getEmailRateLimitKey(body);

    if (emailKey !== null) {
      this.rateLimitService.assertAllowed(`auth-${action}-email`, emailKey);
    }
  }
}
