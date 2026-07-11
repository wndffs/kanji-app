import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { KanaController } from "./kana.controller";
import { PrismaKanaRepository, KanaRepository } from "./kana.repository";
import { KanaService } from "./kana.service";

@Module({
  imports: [AuthModule],
  controllers: [KanaController],
  providers: [
    KanaService,
    {
      provide: KanaRepository,
      useClass: PrismaKanaRepository,
    },
  ],
})
export class KanaModule {}
