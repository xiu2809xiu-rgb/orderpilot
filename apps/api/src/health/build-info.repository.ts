import { readFileSync } from "node:fs";
import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import { AppConfig } from "../config/app-config.js";

export interface BuildInfo {
  readonly name: string;
  readonly version: string;
  readonly gitSha: string | null;
}

const packageSchema = z.object({ name: z.string(), version: z.string() });

/**
 * Where the build's identity is read from. A repository does not have to be a
 * database: it is the one place a service goes for data it does not own, so
 * the service stays testable and the source can change.
 */
@Injectable()
export class BuildInfoRepository {
  private cached: BuildInfo | undefined;

  constructor(@Inject(AppConfig) private readonly config: AppConfig) {}

  read(): BuildInfo {
    this.cached ??= this.load();
    return this.cached;
  }

  private load(): BuildInfo {
    // apps/api/package.json, from src/health or dist/health alike.
    const raw: unknown = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    );
    const pkg = packageSchema.parse(raw);
    return { name: pkg.name, version: pkg.version, gitSha: this.config.gitSha };
  }
}
