import type { INestApplicationContext } from "@nestjs/common";
import { describeDataset, syntheticDataset } from "@orderpilot/synthetic-data";
import { AppConfig } from "../../config/app-config.js";
import { DEMO_ACCOUNTS } from "../../auth/demo-accounts.js";
import { PasswordHasher } from "../../auth/domain/password-hasher.js";
import { Database } from "../database.js";
import { UserRepository } from "../../users/user.repository.js";
import { AuditEventRepository } from "../../audit/audit-event.repository.js";
import { AuditService } from "../../audit/audit.service.js";
import { MigrationMarkerAuditor } from "../../audit/migration-marker.auditor.js";
import { seedApprovalSetups } from "../../modules/governance/approval-setup-seed.js";
import { seedRolePermissions } from "../../modules/governance/role-permission-seed.js";
import { seedWorkflows } from "../../modules/workflows/workflows-seed.js";
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
 * What the platform checks today, as a fresh database starts. Area 4 edits the
 * live table, and its seed leaves out a pair revoked on purpose (ADR 0053).
 */
const rolePermissions: Seeder = {
  name: "role permissions",
  run(app) {
    return seedRolePermissions(app);
  },
};

/**
 * One user per role. A user that exists is kept; its password is set from
 * DEMO_PASSWORD only when it does not match already (hashing is slow, and a
 * new hash every run would be noise). Each created user is audited in the same
 * transaction.
 */
const demoUsers: Seeder = {
  name: "users",
  async run(app) {
    const config = app.get(AppConfig);
    const users = app.get(UserRepository);
    const hasher = app.get(PasswordHasher);
    const audit = app.get(AuditService);
    const database = app.get(Database);
    const password = config.auth.demoPassword;
    let created = 0;
    let passwords = 0;
    let renamed = 0;
    for (const account of DEMO_ACCOUNTS) {
      const existing = await users.findByEmail(account.email);
      if (existing) {
        // A demo persona renamed in the code (the approver was, in P-84) must
        // reach databases that were seeded earlier. Only the demo accounts
        // matched by email are touched, never a user an admin created.
        if (existing.displayName !== account.displayName) {
          await database.transaction(async () => {
            await users.setDisplayName(existing.id, account.displayName);
            await audit.record({
              actor: { kind: "system", name: "seed" },
              action: "user.renamed",
              entityType: "User",
              entityId: existing.id,
              summary: `${existing.displayName} is now shown as ${account.displayName}`,
              changes: {
                from: existing.displayName,
                to: account.displayName,
              },
              traceId: "seed",
            });
          });
          renamed += 1;
        }
        if (
          password !== null &&
          !(await hasher.check(existing.passwordHash, password))
        ) {
          const hash = await hasher.hash(password);
          await database.transaction(async () => {
            await users.setPasswordHash(existing.id, hash);
            await audit.record({
              actor: { kind: "system", name: "seed" },
              action: "user.password-reset",
              entityType: "User",
              entityId: existing.id,
              summary: `${account.displayName} had the password reset from DEMO_PASSWORD`,
              changes: { source: "DEMO_PASSWORD" },
              traceId: "seed",
            });
          });
          passwords += 1;
        }
        continue;
      }
      const passwordHash =
        password === null ? null : await hasher.hash(password);
      await database.transaction(async () => {
        const user = await users.create({
          email: account.email,
          displayName: account.displayName,
          role: account.role,
          passwordHash,
        });
        await audit.record({
          actor: { kind: "system", name: "seed" },
          action: "user.created",
          entityType: "User",
          entityId: user.id,
          summary: `${account.displayName} was created as ${account.role}`,
          changes: { role: account.role, hasPassword: passwordHash !== null },
          traceId: "seed",
        });
      });
      created += 1;
    }
    const note =
      password === null
        ? " (no DEMO_PASSWORD, so none can sign in by password)"
        : "";
    return `${String(created)} created, ${String(passwords)} passwords reset, ${String(renamed)} renamed, ${String(DEMO_ACCOUNTS.length)} accounts in all${note}`;
  },
};

/** Area 4's sample approval chain (F-3), which needs the demo accounts above. */
const approvalSetups: Seeder = {
  name: "approval setups",
  run(app) {
    return seedApprovalSetups(app);
  },
};

/**
 * The synthetic dataset, built for today in Asia/Singapore, and the same set
 * the mock read models answer from. The workflow tables below load their part
 * of it; the order tables arrive with P-18 and will load the rest. Here it
 * checks that the set builds and says what is in it.
 */
const syntheticData: Seeder = {
  name: "synthetic data",
  run() {
    return Promise.resolve(describeDataset(syntheticDataset()));
  },
};

/** Area 2's sample rows: the sales flow, document settings, instances, tasks and reminders. */
const workflowSamples: Seeder = {
  name: "workflows",
  async run(app) {
    return seedWorkflows(app.get(Database).client);
  },
};

/**
 * The audit events of what a data migration changed, one for each marker it
 * left (ADR 0058, decision 8). A fresh database has no markers and gets none.
 * It runs last, so every earlier step's own events come first.
 */
const migrationMarkers: Seeder = {
  name: "migration markers",
  async run(app) {
    const written = await app.get(MigrationMarkerAuditor).record();
    return `${String(written)} migration changes recorded in the audit trail`;
  },
};

/**
 * In the order they run. The audit trail starts first, so the users' creation
 * lands after its first link; later stories load the synthetic data into their
 * tables.
 */
export const SEEDERS: readonly Seeder[] = [
  storageBucket,
  auditGenesis,
  rolePermissions,
  demoUsers,
  approvalSetups,
  syntheticData,
  workflowSamples,
  migrationMarkers,
];
