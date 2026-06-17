import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { ItemsController } from "./items.controller";
import { ItemsService } from "./items.service";
import { ItemsRepository, PrismaItemsRepository } from "./items.repository";

@Module({
  imports: [AuthModule],
  controllers: [ItemsController],
  providers: [
    ItemsService,
    {
      provide: ItemsRepository,
      useClass: PrismaItemsRepository,
    },
  ],
})
export class ItemsModule {}
