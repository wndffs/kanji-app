import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DecksController } from "./decks.controller";
import { DecksRepository, PrismaDecksRepository } from "./decks.repository";
import { DecksService } from "./decks.service";
import { SecurityModule } from "../security/security.module";

@Module({
  imports:[SecurityModule],
  imports: [AuthModule],
  controllers: [DecksController],
  providers: [
    DecksService,
    {
      provide: DecksRepository,
      useClass: PrismaDecksRepository,
    },
  ],
})
export class DecksModule {}
