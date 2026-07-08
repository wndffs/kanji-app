import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";

import { AdminGuard } from "../auth/admin.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { type CurrentUserDto } from "../auth/auth.types";
import { AdminService } from "./admin.service";

@UseGuards(AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

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
  listReviewItems(@Query() query: Record<string, unknown>) {
    return this.adminService.listReviewItems(query);
  }

  @Get("import-runs")
  listImportRuns() {
    return this.adminService.listImportRuns();
  }

  @Get("curriculum/completeness")
  getCompletenessReport() {
    return this.adminService.getCompletenessReport();
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

  @Post("imported-candidates/promote")
  promoteImportedCandidate(@Body() body: unknown) {
    return this.adminService.promoteImportedCandidate(body);
  }
}
