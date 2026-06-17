import { Module, type MiddlewareConsumer, type NestModule } from "@nestjs/common";

import { AdminModule } from "./admin/admin.module";
import { AuthModule } from "./auth/auth.module";
import { AppConfigModule } from "./config/app-config.module";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { ApiLogger } from "./logging/api-logger.service";
import { RequestLoggerMiddleware } from "./logging/request-logger.middleware";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [AppConfigModule, DatabaseModule, HealthModule, AuthModule, UsersModule, AdminModule],
  providers: [ApiLogger],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes("*");
  }
}
