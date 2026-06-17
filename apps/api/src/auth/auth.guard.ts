import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

import { AuthService } from "./auth.service";
import { type RequestWithCurrentUser } from "./auth.types";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithCurrentUser>();
    const token = readBearerToken(request.headers ?? {});

    request.currentUser = await this.authService.authenticateToken(token);

    return true;
  }
}

export function readBearerToken(headers: Record<string, string | string[] | undefined>): string {
  const authorization = headers.authorization ?? headers.Authorization;
  const value = Array.isArray(authorization) ? authorization[0] : authorization;

  if (value === undefined || !value.startsWith("Bearer ")) {
    throw new UnauthorizedException("Authorization bearer token is required.");
  }

  return value.slice("Bearer ".length).trim();
}
