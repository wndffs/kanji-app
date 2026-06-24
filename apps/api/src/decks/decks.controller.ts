import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { type CurrentUserDto } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { DecksService } from "./decks.service";

@UseGuards(AuthGuard)
@Controller("decks")
export class DecksController {
  constructor(@Inject(DecksService) private readonly decksService: DecksService) {}

  @Post("from-text")
  createFromText(@CurrentUser() currentUser: CurrentUserDto, @Body() body: unknown) {
    return this.decksService.createFromText(currentUser, body);
  }

  @Get()
  listDecks(@CurrentUser() currentUser: CurrentUserDto) {
    return this.decksService.listDecks(currentUser);
  }

  @Get(":deckId")
  getDeck(@CurrentUser() currentUser: CurrentUserDto, @Param("deckId") deckId: string) {
    return this.decksService.getDeck(currentUser, deckId);
  }
}
