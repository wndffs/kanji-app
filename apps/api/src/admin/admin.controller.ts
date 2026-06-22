import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";

import { AdminGuard } from "../auth/admin.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { type CurrentUserDto } from "../auth/auth.types";
import { AdminService } from "./admin.service";

@UseGuards(AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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

  @Get("items/review-queue")
  listReviewItems() {
    return this.adminService.listReviewItems();
  }

  @Get("items/:itemId")
  getCurationItem(@Param("itemId") itemId: string) {
    return this.adminService.getCurationItem(itemId);
  }

  @Patch("items/:itemId")
  updateItem(@Param("itemId") itemId: string, @Body() body: unknown) {
    return this.adminService.updateItem(itemId, body);
  }

  @Patch("cards/:cardId/answers")
  updateCardAnswers(@Param("cardId") cardId: string, @Body() body: unknown) {
    return this.adminService.updateCardAnswers(cardId, body);
  }
}
