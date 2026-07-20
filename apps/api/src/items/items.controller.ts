import { Controller, Get, Inject, Param, Query, UseGuards } from "@nestjs/common";

import { type CurrentUserDto } from "../auth/auth.types";
import { OptionalCurrentUser } from "../auth/optional-current-user.decorator";
import { OptionalAuthGuard } from "../auth/optional-auth.guard";
import { ItemsService } from "./items.service";
import { type ParsedItemHistoryQuery, type ParsedSearchQuery } from "./items.types";

@UseGuards(OptionalAuthGuard)
@Controller()
export class ItemsController {
  constructor(@Inject(ItemsService) private readonly itemsService: ItemsService) {}

  @Get("items/:id")
  getItem(@Param("id") id: string, @OptionalCurrentUser() currentUser: CurrentUserDto | null) {
    return this.itemsService.getItemDetails(id, currentUser);
  }

  @Get("items/:id/history")
  getItemHistory(
    @Param("id") id: string,
    @Query() query: ParsedItemHistoryQuery,
    @OptionalCurrentUser() currentUser: CurrentUserDto | null,
  ) {
    return this.itemsService.getItemHistory(id, query, currentUser);
  }

  @Get("kanji/:character")
  getKanji(
    @Param("character") character: string,
    @OptionalCurrentUser() currentUser: CurrentUserDto | null,
  ) {
    return this.itemsService.getKanjiDetails(character, currentUser);
  }

  @Get("search")
  search(
    @Query() query: ParsedSearchQuery,
    @OptionalCurrentUser() currentUser: CurrentUserDto | null,
  ) {
    return this.itemsService.search(query, currentUser);
  }
}
