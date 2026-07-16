import { Module, type MiddlewareConsumer, type NestModule } from "@nestjs/common";

import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { AppConfigModule } from "./config/app-config.module";
import { CoursesModule } from "./courses/courses.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { DatabaseModule } from "./database/database.module";
import { DecksModule } from "./decks/decks.module";
import { HealthModule } from "./health/health.module";
import { ItemsModule } from "./items/items.module";
import { KanaModule } from "./kana/kana.module";
import { LessonsModule } from "./lessons/lessons.module";
import { ApiLogger } from "./logging/api-logger.service";
import { RequestLoggerMiddleware } from "./logging/request-logger.middleware";
import { OverridesModule } from "./overrides/overrides.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    AdminModule,
    ItemsModule,
    KanaModule,
    DashboardModule,
    LessonsModule,
    OverridesModule,
    ReviewsModule,
    DecksModule,
  ],
  providers: [ApiLogger],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes("*");
  }
}
