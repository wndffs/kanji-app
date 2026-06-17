import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

import { AuthService } from "./auth.service";
import { type RequestWithCurrentUser } from "./auth.types";
import { readBearerToken } from "./auth.guard";

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithCurrentUser>();
    const headers = request.headers ?? {};

    if (!hasAuthorizationHeader(headers)) {
      return true;
    }

    const token = readBearerToken(headers);
    request.currentUser = await this.authService.authenticateToken(token);

    return true;
  }
}

function hasAuthorizationHeader(headers: Record<string, string | string[] | undefined>): boolean {
  const value = headers.authorization ?? headers.Authorization;

  if (value === undefined) {
    return false;
  }

  const authorization = Array.isArray(value) ? value[0] : value;

  if (authorization.trim() === "") {
    throw new UnauthorizedException("Authorization bearer token is required.");
  }

  return true;
}
