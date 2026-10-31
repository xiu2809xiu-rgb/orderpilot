import { NotFoundException, VersioningType } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import type { DestinationStream } from "pino";
import {
  renderError,
  AllExceptionsFilter,
} from "../common/all-exceptions.filter.js";
import {
  DEFAULT_VERSION,
  GLOBAL_PREFIX,
  PROBE_PATHS,
} from "../common/api-paths.js";
import { requestIdOf } from "../common/request-id.js";
import type { AppConfig } from "../config/app-config.js";
import { BuildInfoRepository } from "../health/build-info.repository.js";
import { AppLogger } from "../logging/app-logger.js";
import { createRootLogger, requestLogging } from "../logging/logger.config.js";
import { applySecurity } from "./security.js";
import { setupSwagger } from "./swagger.js";

export interface ConfigureOptions {
  /** Where log lines go. Tests pass a stream to read them; the app writes to stdout. */
  readonly logStream?: DestinationStream;
}

/**
 * Everything between creating the app and listening. main.ts and the HTTP
 * tests both call it, so a test exercises the same stack that runs. It
 * initialises the app, because the 404 handler must come after every route.
 */
export async function configureApp(
  app: NestExpressApplication,
  config: AppConfig,
  options: ConfigureOptions = {},
): Promise<void> {
  const rootLogger = createRootLogger(config, options.logStream);
  app.useLogger(new AppLogger(rootLogger));

  // First, so it sees every request and its line is written once.
  app.use(...requestLogging(rootLogger));
  applySecurity(app, config);

  app.setGlobalPrefix(GLOBAL_PREFIX, { exclude: [...PROBE_PATHS] });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: DEFAULT_VERSION,
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  if (config.http.swaggerEnabled) {
    setupSwagger(app, app.get(BuildInfoRepository).read().version);
  }

  await app.init();

  // Nest answers 404 only under the prefix. A path outside it (/nope) falls
  // through to here, so it gets the same envelope instead of Express's page.
  app
    .getHttpAdapter()
    .getInstance()
    .use((req: Request, res: Response) => {
      const { status, body } = renderError(
        new NotFoundException(),
        requestIdOf(req),
      );
      res.status(status).json(body);
    });
}
