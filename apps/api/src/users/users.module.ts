import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { SessionsModule } from "../sessions/sessions.module.js";
import { UserRepository } from "./user.repository.js";
import { UsersController } from "./users.controller.js";
import { UsersService } from "./users.service.js";

@Module({
  imports: [AuditModule, SessionsModule],
  controllers: [UsersController],
  providers: [UserRepository, UsersService],
  exports: [UserRepository],
})
export class UsersModule {}
