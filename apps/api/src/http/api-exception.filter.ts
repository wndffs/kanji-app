import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";

import { type ApiLogger } from "../logging/api-logger.service";

type ErrorResponse = {
  readonly statusCode: number;
  readonly message: string | readonly string[];
  readonly error: string;
  readonly timestamp: string;
  readonly path: string;
};

type HttpResponseLike = {
  status(statusCode: number): {
    json(body: ErrorResponse): void;
  };
};

type HttpRequestLike = {
  readonly url?: string;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: ApiLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<HttpResponseLike>();
    const request = context.getRequest<HttpRequestLike>();
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const errorResponse = normalizeErrorResponse(exception, statusCode);

    if (statusCode >= 500) {
      this.logger.error(
        JSON.stringify({
          event: "api.error",
          statusCode,
          path: request.url ?? "unknown",
          message: errorResponse.message,
        }),
      );
    }

    response.status(statusCode).json({
      ...errorResponse,
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url ?? "unknown",
    });
  }
}

function normalizeErrorResponse(
  exception: unknown,
  statusCode: number,
): Omit<ErrorResponse, "statusCode" | "timestamp" | "path"> {
  if (exception instanceof HttpException) {
    const response = exception.getResponse();

    if (typeof response === "string") {
      return {
        message: response,
        error: exception.name,
      };
    }

    if (isRecord(response)) {
      return {
        message: readMessage(response),
        error: readError(response, exception.name),
      };
    }
  }

  return {
    message: statusCode >= 500 ? "Внутренняя ошибка сервера." : "Не удалось обработать запрос.",
    error: statusCode >= 500 ? "InternalServerError" : "RequestError",
  };
}

function readMessage(response: Record<string, unknown>): string | readonly string[] {
  const message = response.message;

  if (typeof message === "string" || isStringArray(message)) {
    return message;
  }

  return "Не удалось обработать запрос.";
}

function readError(response: Record<string, unknown>, fallback: string): string {
  return typeof response.error === "string" ? response.error : fallback;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
