import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { KanaModule } from "../kana/kana.module";
import { CharactersController } from "./characters.controller";
import { CharactersRepository, PrismaCharactersRepository } from "./characters.repository";
import { CharactersService } from "./characters.service";

@Module({
  imports: [AuthModule, KanaModule],
  controllers: [CharactersController],
  providers: [
    CharactersService,
    {
      provide: CharactersRepository,
      useClass: PrismaCharactersRepository,
    },
  ],
})
export class CharactersModule {}
