import { Module } from "@nestjs/common";

import { AdminGuard } from "./admin.guard";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
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
    AdminGuard,
    {
      provide: UsersRepository,
      useClass: PrismaUsersRepository,
    },
  ],
  exports: [AuthService, AuthGuard, AdminGuard, UsersRepository],
})
export class AuthModule {}
