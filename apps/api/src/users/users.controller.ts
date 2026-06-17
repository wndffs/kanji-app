import { Controller, Get, Headers, Inject } from "@nestjs/common";

import { AuthService } from "../auth/auth.service";
import { type CurrentUserDto } from "../auth/current-user.dto";

@Controller("users")
export class UsersController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Get("me")
  getCurrentUser(
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): CurrentUserDto {
    return this.authService.getCurrentUser(headers);
  }
}
