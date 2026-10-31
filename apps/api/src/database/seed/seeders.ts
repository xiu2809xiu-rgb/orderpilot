import type { INestApplicationContext } from "@nestjs/common";
import {
  createSyntheticDataset,
  describeDataset,
} from "@orderpilot/synthetic-data";
import { AuditEventRepository } from "../../audit/audit-event.repository.js";
import { AuditService } from "../../audit/audit.service.js";
import { ObjectStorage } from "../../storage/object-storage.js";

/**
 * One step of the seed. Each must be safe to run again and again: look before
 * writing, and say what it did (or found) in one line.
 */
export interface Seeder {
  readonly name: string;
  run(app: INestApplicationContext): Promise<string>;
}

const storageBucket: Seeder = {
  name: "storage",
  async run(app) {
    await app.get(ObjectStorage).ensureBucket();
    return "the document bucket exists";
  },
};

/** The first link of the audit chain, written once. */
const auditGenesis: Seeder = {
  name: "audit",
  async run(app) {
    const events = app.get(AuditEventRepository);
    if (await events.existsByAction("system.seeded")) {
      return "the audit trail was started already";
    }
    await app.get(AuditService).record({
      actor: { kind: "system", name: "seed" },
      action: "system.seeded",
      entityType: "System",
      entityId: "database",
      summary: "The database was created and seeded",
      traceId: "seed",
    });
    return "started the audit trail";
  },
};

/**
 * The synthetic dataset has no tables yet: the order tables arrive with P-18
 * and the workflow tables with C-1, and they will load it here. For now this
 * checks that it builds and says what is in it.
 */
const syntheticData: Seeder = {
  name: "synthetic data",
  run() {
    return Promise.resolve(describeDataset(createSyntheticDataset()));
  },
};

/**
 * In the order they run. P-10 adds the users and the role-permission matrix
 * after the audit step; later stories load the synthetic data into their tables.
 */
export const SEEDERS: readonly Seeder[] = [
  storageBucket,
  auditGenesis,
  syntheticData,
];
