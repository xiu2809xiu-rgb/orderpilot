import { Global, Inject, Module, type OnModuleInit } from "@nestjs/common";
import { ReadinessRegistry } from "../health/readiness-registry.js";
import { Database } from "./database.js";
import { PrismaService } from "./prisma.service.js";

/** Global: any repository may inject `Database`. */
@Global()
@Module({
  providers: [PrismaService, Database],
  exports: [Database],
})
export class DatabaseModule implements OnModuleInit {
  constructor(
    @Inject(ReadinessRegistry) private readonly readiness: ReadinessRegistry,
    @Inject(Database) private readonly database: Database,
  ) {}

  onModuleInit(): void {
    this.readiness.register({
      name: "database",
      check: () => this.database.ping(),
    });
  }
}
