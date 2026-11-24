import {
  Inject,
  Module,
  type OnApplicationBootstrap,
  type OnModuleInit,
} from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module.js";
import { PermissionPolicy } from "../../auth/permission-policy.js";
import { RolePermissionRepository } from "../../auth/role-permission.repository.js";
import { UsersModule } from "../../users/users.module.js";
import { AiModule } from "../ai/ai.module.js";
import { MockScriptRegistry } from "../ai/providers/mock-scripts.js";
import { GovernancePermissionPolicy } from "../governance/governance-permission-policy.js";
import {
  PICTURE_CHECK_FEATURE,
  pictureCheckMockScript,
} from "./domain/picture-check.js";
import { PictureAuditor } from "./picture-auditor.js";
import {
  DEFAULT_PICTURE_CHECK_WAIT_MS,
  PICTURE_CHECK_WAIT_MS,
  PictureCheckService,
} from "./picture-check.service.js";
import { PictureClock, SystemPictureClock } from "./picture-clock.js";
import { PictureImageService } from "./picture-image.service.js";
import { PictureOwnerService } from "./picture-owner.service.js";
import { PictureReviewers } from "./picture-reviewers.js";
import { PictureStore } from "./picture-store.js";
import { PictureUploadGuard } from "./picture-upload-guard.js";
import { PictureUploadService } from "./picture-upload.service.js";
import { ProfilePicturesController } from "./profile-pictures.controller.js";
import { ProfilePictureRepository } from "./profile-picture.repository.js";

/**
 * Area 1, the platform: profile pictures a person approves (ADR 0068). Fixed
 * rules refuse a bad file, an AI check describes the picture when the data rule
 * allows one, and a person approves or rejects it.
 *
 * It is a plain module, not a dynamic one, for the reason AiModule gives:
 * importing AuthModule.register(config) would make Nest build a second
 * AuthModule. So, like AiModule, it keeps its own stateless
 * RolePermissionRepository and binds the same policy class under the same
 * token, to ask "may this role manage users" when it decides who may see a
 * pending picture. Storage, the database and Redis are global modules.
 */
@Module({
  imports: [AuditModule, UsersModule, AiModule],
  controllers: [ProfilePicturesController],
  providers: [
    // Stateless, so a second instance beside AuthModule's is harmless.
    RolePermissionRepository,
    { provide: PermissionPolicy, useClass: GovernancePermissionPolicy },
    { provide: PictureClock, useClass: SystemPictureClock },
    { provide: PICTURE_CHECK_WAIT_MS, useValue: DEFAULT_PICTURE_CHECK_WAIT_MS },
    ProfilePictureRepository,
    PictureAuditor,
    PictureStore,
    PictureUploadGuard,
    PictureCheckService,
    PictureOwnerService,
    PictureUploadService,
    PictureReviewers,
    PictureImageService,
  ],
})
export class ProfilePicturesModule
  implements OnModuleInit, OnApplicationBootstrap
{
  constructor(
    @Inject(MockScriptRegistry) private readonly scripts: MockScriptRegistry,
    @Inject(PictureStore) private readonly store: PictureStore,
  ) {}

  /** The mock AI's answer for this feature, registered here as AiModule documents. */
  onModuleInit(): void {
    this.scripts.register(PICTURE_CHECK_FEATURE, pictureCheckMockScript);
  }

  /** Objects whose delete failed before the last stop are retried now; the sweep never throws. */
  async onApplicationBootstrap(): Promise<void> {
    await this.store.sweepAtStart();
  }
}
