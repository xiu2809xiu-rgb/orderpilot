import { VersioningType } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import {
  DEFAULT_VERSION,
  GLOBAL_PREFIX,
  PROBE_PATHS,
} from "../common/api-paths.js";

/**
 * The prefix and the version. The running app and the spec export both call
 * it, so the committed OpenAPI file lists exactly the paths the API serves.
 */
export function applyRouting(app: NestExpressApplication): void {
  app.setGlobalPrefix(GLOBAL_PREFIX, { exclude: [...PROBE_PATHS] });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: DEFAULT_VERSION,
  });
}
