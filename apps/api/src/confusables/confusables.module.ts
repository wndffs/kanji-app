import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { OverridesModule } from "../overrides/overrides.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { SecurityModule } from "../security/security.module";
import { AdminConfusablesController } from "./admin-confusables.controller";
import { ConfusablesController } from "./confusables.controller";
import { ConfusablesRepository, PrismaConfusablesRepository } from "./confusables.repository";
import { ConfusablesService } from "./confusables.service";

@Module({
  imports: [AuthModule, OverridesModule, ReviewsModule, SecurityModule],
  controllers: [ConfusablesController, AdminConfusablesController],
  providers: [
    ConfusablesService,
    {
      provide: ConfusablesRepository,
      useClass: PrismaConfusablesRepository,
    },
  ],
})
export class ConfusablesModule {}
