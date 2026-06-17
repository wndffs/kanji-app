import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import { type CurrentUserDto, type RequestWithCurrentUser } from "./auth.types";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUserDto => {
    const request = context.switchToHttp().getRequest<RequestWithCurrentUser>();

    if (request.currentUser === undefined) {
      throw new Error("CurrentUser decorator used without AuthGuard.");
    }

    return request.currentUser;
  },
);
