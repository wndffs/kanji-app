import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";

import { ApiLogger } from "./api-logger.service";

type RequestLike = {
  readonly method?: string;
  readonly originalUrl?: string;
  readonly url?: string;
};

type ResponseLike = {
  readonly statusCode?: number;
  on(event: "finish", listener: () => void): void;
};

type NextFunctionLike = () => void;

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(@Inject(ApiLogger) private readonly logger: ApiLogger) {}

  use(request: RequestLike, response: ResponseLike, next: NextFunctionLike): void {
    const startedAt = Date.now();

    response.on("finish", () => {
      this.logger.log(
        JSON.stringify({
          event: "http.request",
          method: request.method ?? "UNKNOWN",
          path: request.originalUrl ?? request.url ?? "unknown",
          statusCode: response.statusCode ?? 0,
          durationMs: Date.now() - startedAt,
        }),
        "RequestLogger",
      );
    });

    next();
  }
}
