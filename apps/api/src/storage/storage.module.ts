import { Global, Inject, Module, type OnModuleInit } from "@nestjs/common";
import { ReadinessRegistry } from "../health/readiness-registry.js";
import { ObjectStorage } from "./object-storage.js";
import { S3ObjectStorage } from "./s3-object-storage.js";

/** Global: services ask for `ObjectStorage`, never for the S3 class. */
@Global()
@Module({
  providers: [
    S3ObjectStorage,
    { provide: ObjectStorage, useExisting: S3ObjectStorage },
  ],
  exports: [ObjectStorage, S3ObjectStorage],
})
export class StorageModule implements OnModuleInit {
  constructor(
    @Inject(ReadinessRegistry) private readonly readiness: ReadinessRegistry,
    @Inject(ObjectStorage) private readonly storage: ObjectStorage,
  ) {}

  onModuleInit(): void {
    this.readiness.register({
      name: "storage",
      check: () => this.storage.ping(),
    });
  }
}
