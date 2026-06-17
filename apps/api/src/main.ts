import "reflect-metadata";

import { type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { AppConfigService } from "./config/app-config.service";
import { ApiExceptionFilter } from "./http/api-exception.filter";
import { ApiValidationPipe } from "./http/api-validation.pipe";
import { ApiLogger } from "./logging/api-logger.service";

export function configureApiApp(app: INestApplication): void {
  const config = app.get(AppConfigService);
  const logger = app.get(ApiLogger);

  app.useLogger(logger);
  app.enableCors({
    credentials: true,
    origin: config.webOrigin,
  });
  app.useGlobalFilters(new ApiExceptionFilter(logger));
  app.useGlobalPipes(new ApiValidationPipe());
}

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  configureApiApp(app);

  const config = app.get(AppConfigService);
  const logger = app.get(ApiLogger);

  await app.listen(config.port);
  logger.log(
    JSON.stringify({
      event: "api.started",
      port: config.port,
      environment: config.environment,
      authMode: config.authMode,
    }),
    "Bootstrap",
  );
}

const entryPoint = process.argv[1] ?? "";

if (entryPoint.endsWith("main.ts") || entryPoint.endsWith("main.js")) {
  void bootstrap();
}
