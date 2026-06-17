import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";

import { AuthGuard } from "./auth.guard";
import { type RequestWithCurrentUser } from "./auth.types";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(AuthGuard) private readonly authGuard: AuthGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await this.authGuard.canActivate(context);

    const request = context.switchToHttp().getRequest<RequestWithCurrentUser>();

    if (request.currentUser?.role !== "ADMIN") {
      throw new ForbiddenException("Admin role is required.");
    }

    return true;
  }
}
