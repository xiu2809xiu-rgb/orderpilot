import { Module } from "@nestjs/common";
import { RecoveryCodeRepository } from "./recovery-code.repository.js";
import { TwoStepChallengeRepository } from "./two-step-challenge.repository.js";
import { TwoStepRepository } from "./two-step.repository.js";

/**
 * The two-step stores, shared by sign-in (auth) and the administrator's reset
 * (users). A leaf module: it imports nothing from auth, so the users module can
 * use it without a cycle, as SessionsModule is used.
 */
@Module({
  providers: [
    TwoStepRepository,
    TwoStepChallengeRepository,
    RecoveryCodeRepository,
  ],
  exports: [
    TwoStepRepository,
    TwoStepChallengeRepository,
    RecoveryCodeRepository,
  ],
})
export class TwoStepStoreModule {}
