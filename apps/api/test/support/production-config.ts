import type { AppConfig } from "../../src/config/app-config.js";

/**
 * The same configuration with only the environment changed to production. The
 * environment schema is not run again: it would refuse the test's example
 * secrets, and a test of one rule has no need of the rest of production's.
 * The getters of AppConfig read `appEnv`, so `isProduction` follows it.
 */
export function inProduction(config: AppConfig): AppConfig {
  return Object.create(config, {
    appEnv: { value: "production" },
  }) as AppConfig;
}
