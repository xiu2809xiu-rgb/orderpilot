import { Module } from "@nestjs/common";
import { RefreshTokenRepository } from "./refresh-token.repository.js";

/** The refresh-token store, shared by sign-in (auth) and disabling a user (users). */
@Module({
  providers: [RefreshTokenRepository],
  exports: [RefreshTokenRepository],
})
export class SessionsModule {}
