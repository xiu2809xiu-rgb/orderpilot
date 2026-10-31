// `pnpm db:seed`: fills the development database. Safe to run again.
import { AppConfig } from "../../config/app-config.js";
import { ConfigError } from "../../config/config-error.js";
import {
  ENV_FILES,
  ROOT_ENV_FILE,
  loadEnvFiles,
} from "../../config/load-env-files.js";
import { runSeed } from "./run-seed.js";

try {
  loadEnvFiles();
  const config = AppConfig.fromEnv(process.env, {
    createFile: ROOT_ENV_FILE,
    readFiles: ENV_FILES,
  });
  await runSeed(config, (line) => process.stdout.write(`${line}\n`));
} catch (error) {
  if (error instanceof ConfigError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
  throw error;
}
