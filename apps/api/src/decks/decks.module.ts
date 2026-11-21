import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { LessonsModule } from "../lessons/lessons.module";
import { DeckPrerequisitesController } from "./deck-prerequisites.controller";
import { DeckPrerequisitesService } from "./deck-prerequisites.service";
import { DecksController } from "./decks.controller";
import { DecksRepository, PrismaDecksRepository } from "./decks.repository";
import { DecksService } from "./decks.service";
import { SecurityModule } from "../security/security.module";

@Module({
  imports: [AuthModule, SecurityModule, LessonsModule],
  controllers: [DecksController, DeckPrerequisitesController],
  providers: [
    DecksService,
    DeckPrerequisitesService,
    {
      provide: DecksRepository,
      useClass: PrismaDecksRepository,
    },
  ],
})
export class DecksModule {}
