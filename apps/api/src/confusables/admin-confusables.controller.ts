import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";

import { AdminGuard } from "../auth/admin.guard";
import { type CurrentUserDto } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { ConfusablesService } from "./confusables.service";

@UseGuards(AdminGuard)
@Controller("admin/confusables")
export class AdminConfusablesController {
  constructor(
    @Inject(ConfusablesService) private readonly confusablesService: ConfusablesService,
  ) {}

  @Get()
  listPairs() {
    return this.confusablesService.listAdminPairs();
  }

  @Post()
  createPair(@CurrentUser() user: CurrentUserDto, @Body() body: unknown) {
    return this.confusablesService.createAdminPair(user.id, body);
  }

  @Patch(":id")
  updatePair(@Param("id") id: string, @Body() body: unknown) {
    return this.confusablesService.updateAdminPair(id, body);
  }

  @Post(":id/publish")
  publishPair(@CurrentUser() user: CurrentUserDto, @Param("id") id: string) {
    return this.confusablesService.publishAdminPair(user.id, id);
  }
}
