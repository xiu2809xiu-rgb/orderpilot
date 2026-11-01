// The worker entry point (`node dist/worker/worker.js`).
//
// The smallest honest worker: it validates the same configuration as the API,
// keeps a connection to Redis, and reports healthy only while Redis answers. It
// consumes no queue yet. P-15 brings the processors into `main`; the image, the
// compose service and the health check stay as they are.
import { Redis } from "ioredis";
import { AppConfig } from "../config/app-config.js";
import { ConfigError } from "../config/config-error.js";
import {
  ENV_FILES,
  ROOT_ENV_FILE,
  loadEnvFiles,
} from "../config/load-env-files.js";
import { createRootLogger } from "../logging/logger.config.js";
import { HEARTBEAT_INTERVAL_MS, beat } from "./heartbeat.js";

function main(): void {
  loadEnvFiles();
  const config = AppConfig.fromEnv(process.env, {
    createFile: ROOT_ENV_FILE,
    readFiles: ENV_FILES,
  });
  const logger = createRootLogger(config);

  // Without the offline queue a ping fails at once while Redis is away, rather
  // than waiting in a queue that grows by one every interval.
  const redis = new Redis(config.redis.url, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
  });
  // An unreachable Redis shows as a stale heartbeat, not as a crash.
  redis.on("error", () => undefined);

  const tick = async (): Promise<void> => {
    try {
      await redis.ping();
      beat();
    } catch {
      // No beat: the health check turns red after the maximum age.
    }
  };
  redis.on("ready", () => void tick());
  const timer = setInterval(() => void tick(), HEARTBEAT_INTERVAL_MS);

  logger.info({ appEnv: config.appEnv, queues: 0 }, "worker started");

  const stop = (signal: string): void => {
    clearInterval(timer);
    redis.disconnect();
    logger.info({ signal }, "worker stopped");
    process.exit(0);
  };
  process.once("SIGTERM", () => {
    stop("SIGTERM");
  });
  process.once("SIGINT", () => {
    stop("SIGINT");
  });
}

try {
  main();
} catch (error) {
  if (error instanceof ConfigError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
  throw error;
}
