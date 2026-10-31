import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { AppConfig } from "../config/app-config.js";
import { PrismaClient } from "../generated/prisma/client.js";

/**
 * Owns the one Prisma client of the process, connected through the pg driver
 * adapter. Only `Database` and the repositories use it: nothing else imports
 * Prisma (a lint rule checks).
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(@Inject(AppConfig) config: AppConfig) {
    this.client = new PrismaClient({
      adapter: new PrismaPg({ connectionString: config.database.url }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
