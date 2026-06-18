import { Body, Controller, Delete, Get, Inject, Param, Post, Put, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { type CurrentUserDto } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { OverridesService } from "./overrides.service";

@UseGuards(AuthGuard)
@Controller()
export class OverridesController {
  constructor(@Inject(OverridesService) private readonly overridesService: OverridesService) {}

  @Get("cards/:cardId/overrides")
  listCardOverrides(@Param("cardId") cardId: string, @CurrentUser() currentUser: CurrentUserDto) {
    return this.overridesService.listCardOverrides(cardId, currentUser);
  }

  @Post("cards/:cardId/overrides")
  addAcceptedAnswer(
    @Param("cardId") cardId: string,
    @CurrentUser() currentUser: CurrentUserDto,
    @Body() body: unknown,
  ) {
    return this.overridesService.addAcceptedAnswer(cardId, currentUser, body);
  }

  @Delete("cards/:cardId/overrides/:overrideId")
  deleteAcceptedAnswer(
    @Param("cardId") cardId: string,
    @Param("overrideId") overrideId: string,
    @CurrentUser() currentUser: CurrentUserDto,
  ) {
    return this.overridesService.deleteAcceptedAnswer(cardId, overrideId, currentUser);
  }

  @Put("items/:itemId/private-mnemonic")
  savePrivateMnemonic(
    @Param("itemId") itemId: string,
    @CurrentUser() currentUser: CurrentUserDto,
    @Body() body: unknown,
  ) {
    return this.overridesService.savePrivateMnemonic(itemId, currentUser, body);
  }
}
