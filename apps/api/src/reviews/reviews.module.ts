import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { OverridesModule } from "../overrides/overrides.module";
import { SecurityModule } from "../security/security.module";
import { ReviewsController } from "./reviews.controller";
import { ReviewsRepository, PrismaReviewsRepository } from "./reviews.repository";
import { ReviewsService } from "./reviews.service";

@Module({
  imports: [AuthModule, OverridesModule, SecurityModule],
  controllers: [ReviewsController],
  providers: [
    ReviewsService,
    {
      provide: ReviewsRepository,
      useClass: PrismaReviewsRepository,
    },
  ],
})
export class ReviewsModule {}
