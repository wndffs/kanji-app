import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { type CurrentUserDto } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { DecksService } from "./decks.service";
import { RateLimitService } from "../security/rate-limit.service";

@UseGuards(AuthGuard)
@Controller("decks")
export class DecksController {
  constructor(@Inject(DecksService) private readonly decksService: DecksService,
    @Inject(RateLimitService) private readonly rateLimitService: RateLimitService) {}

  @Post("from-text")
  createFromText(@CurrentUser() currentUser: CurrentUserDto, @Body() body: unknown) {
    this.rateLimitService.assertAllowed("text-mining-user",currentUser.id);
    return this.decksService.createFromText(currentUser, body);
  }

  @Post("from-text/preview")
  previewFromText(@CurrentUser() currentUser: CurrentUserDto, @Body() body: unknown) {
    this.rateLimitService.assertAllowed("text-mining-user",currentUser.id);
    return this.decksService.previewFromText(currentUser, body);
  }

  @Get()
  listDecks(@CurrentUser() currentUser: CurrentUserDto) {
    return this.decksService.listDecks(currentUser);
  }

  @Get(":deckId")
  getDeck(@CurrentUser() currentUser: CurrentUserDto, @Param("deckId") deckId: string) {
    return this.decksService.getDeck(currentUser, deckId);
  }

  @Patch(":deckId/status")
  updateStatus(
    @CurrentUser() currentUser: CurrentUserDto,
    @Param("deckId") deckId: string,
    @Body() body: unknown,
  ) {
    return this.decksService.updateStatus(currentUser, deckId, body);
  }
}
