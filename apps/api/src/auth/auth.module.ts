import { Module } from "@nestjs/common";

import { AdminGuard } from "./admin.guard";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { OptionalAuthGuard } from "./optional-auth.guard";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { PrismaUsersRepository, UsersRepository } from "./users.repository";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    AuthGuard,
    OptionalAuthGuard,
    AdminGuard,
    {
      provide: UsersRepository,
      useClass: PrismaUsersRepository,
    },
  ],
  exports: [AuthService, AuthGuard, OptionalAuthGuard, AdminGuard, UsersRepository],
})
export class AuthModule {}
