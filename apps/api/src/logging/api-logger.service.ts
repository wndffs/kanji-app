import { ConsoleLogger, Injectable } from "@nestjs/common";

@Injectable()
export class ApiLogger extends ConsoleLogger {
  log(message: string, context?: string): void {
    super.log(formatLog("info", message, context));
  }

  warn(message: string, context?: string): void {
    super.warn(formatLog("warn", message, context));
  }

  error(message: string, stack?: string, context?: string): void {
    super.error(formatLog("error", message, context), stack);
  }

  debug(message: string, context?: string): void {
    super.debug(formatLog("debug", message, context));
  }
}

function formatLog(level: string, message: string, context?: string): string {
  return JSON.stringify({
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
  });
}
