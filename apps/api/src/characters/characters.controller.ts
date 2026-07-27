import { Controller, Get, Inject, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { type CurrentUserDto } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { CharactersService } from "./characters.service";

@UseGuards(AuthGuard)
@Controller("characters")
export class CharactersController {
  constructor(@Inject(CharactersService) private readonly charactersService: CharactersService) {}

  @Get()
  getHub(@CurrentUser() user: CurrentUserDto) {
    return this.charactersService.getHub(user);
  }
}
