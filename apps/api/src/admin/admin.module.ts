import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { AdminController } from "./admin.controller";
import { AdminRepository, PrismaAdminRepository } from "./admin.repository";
import { AdminService } from "./admin.service";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [AdminController],
  providers: [AdminService, { provide: AdminRepository, useClass: PrismaAdminRepository }],
})
export class AdminModule {}
