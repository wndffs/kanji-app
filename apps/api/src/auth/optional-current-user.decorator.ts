import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import { type CurrentUserDto, type RequestWithCurrentUser } from "./auth.types";

export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUserDto | null => {
    const request = context.switchToHttp().getRequest<RequestWithCurrentUser>();

    return request.currentUser ?? null;
  },
);
