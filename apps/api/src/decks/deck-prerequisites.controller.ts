import { Controller, Get, Inject, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { type CurrentUserDto } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { RateLimitService } from "../security/rate-limit.service";
import { DeckPrerequisitesService } from "./deck-prerequisites.service";

@UseGuards(AuthGuard)
@Controller("decks/:deckId/prerequisites")
export class DeckPrerequisitesController {
  constructor(
    @Inject(DeckPrerequisitesService) private readonly prerequisites: DeckPrerequisitesService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
  ) {}

  @Get()
  preview(@CurrentUser() user: CurrentUserDto, @Param("deckId", ParseUUIDPipe) deckId: string) {
    this.rateLimit.assertAllowed("text-mining-user", user.id);
    return this.prerequisites.preview(user.id, deckId);
  }

  @Post()
  create(@CurrentUser() user: CurrentUserDto, @Param("deckId", ParseUUIDPipe) deckId: string) {
    this.rateLimit.assertAllowed("text-mining-user", user.id);
    return this.prerequisites.create(user.id, deckId);
  }
}
