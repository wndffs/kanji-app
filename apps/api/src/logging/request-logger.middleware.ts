import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";

import { ApiLogger } from "./api-logger.service";
import { getRequestContext, setRequestPrivacyHeaders, type RequestTarget } from "./request-privacy";

type RequestLike = RequestTarget & {
  readonly method?: string;
};

type ResponseLike = {
  readonly statusCode?: number;
  setHeader(name: string, value: string): void;
  once(event: "finish", listener: () => void): void;
};

type NextFunctionLike = () => void;

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(@Inject(ApiLogger) private readonly logger: ApiLogger) {}

  use(request: RequestLike, response: ResponseLike, next: NextFunctionLike): void {
    const startedAt = Date.now();
    const { requestId, path } = getRequestContext(request);
    setRequestPrivacyHeaders(response, requestId);

    response.once("finish", () => {
      this.logger.log(
        JSON.stringify({
          event: "http.request",
          requestId,
          method: request.method ?? "UNKNOWN",
          path,
          statusCode: response.statusCode ?? 0,
          durationMs: Date.now() - startedAt,
        }),
        "RequestLogger",
      );
    });

    next();
  }
}
