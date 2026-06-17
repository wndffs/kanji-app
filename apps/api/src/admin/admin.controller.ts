import { Controller, Get, UseGuards } from "@nestjs/common";

import { AdminGuard } from "../auth/admin.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { type CurrentUserDto } from "../auth/auth.types";

@Controller("admin")
export class AdminController {
  @UseGuards(AdminGuard)
  @Get("status")
  getStatus(@CurrentUser() user: CurrentUserDto): {
    readonly ok: true;
    readonly userId: string;
    readonly role: "ADMIN";
  } {
    return {
      ok: true,
      userId: user.id,
      role: "ADMIN",
    };
  }
}
