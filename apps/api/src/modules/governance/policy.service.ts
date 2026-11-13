import { Inject, Injectable } from "@nestjs/common";
import { syntheticDataset } from "@orderpilot/synthetic-data";
import type {
  AiDestinationDecision,
  AiDestinationRequest,
  AiDestinationRule,
  Role,
} from "@orderpilot/shared";
import { RolePermissionRepository } from "../../auth/role-permission.repository.js";
import {
  DEFAULT_AI_RULES,
  decideAiDestination,
} from "./domain/ai-destination-policy.js";
import { SAMPLE_RULES, mask, sampleNoteRule } from "./domain/masking.js";
import type { MaskingSampleRecord } from "./governance.schemas.js";

// Neutral notes for the synthetic customers. They are made up, and the sample
// rule hides them from roles that do not need them.
const SAMPLE_NOTES = [
  "Prefers email over phone for confirmations.",
  "Asks for the packing list before each shipment.",
  "Consolidates two orders into one container.",
  "Pays on the first working day of the month.",
] as const;

/** The row of the matrix that says who sees the sample note (F-8). */
const NOTE_PERMISSION = "masking.customerNote";

/**
 * The masking sample and the data-to-AI rules. Masking happens here, on the
 * server: a role the rule does not list receives null, never the note. Who
 * the note's rule lists is read from the matrix, so a system admin shows or
 * hides it for a role without a code change.
 */
@Injectable()
export class PolicyService {
  constructor(
    @Inject(RolePermissionRepository)
    private readonly permissions: RolePermissionRepository,
  ) {}

  async maskingSample(role: Role) {
    const holders = (await this.permissions.all())
      .filter((pair) => pair.permission === NOTE_PERMISSION)
      .map((pair) => pair.role);
    const noteRule = sampleNoteRule(holders);
    const rules = SAMPLE_RULES.map((rule) =>
      rule.field === noteRule.field ? noteRule : rule,
    );
    const customers = syntheticDataset().customers.slice(
      0,
      SAMPLE_NOTES.length,
    );
    const records: MaskingSampleRecord[] = customers.map((customer, index) => ({
      customerNo: customer.no,
      customerName: customer.name,
      note: mask(rules, role, noteRule.field, SAMPLE_NOTES[index] ?? ""),
    }));
    return {
      data: { rules, records },
      meta: { mock: true as const },
    };
  }

  aiRules(): AiDestinationRule[] {
    return DEFAULT_AI_RULES.map((rule) => ({
      provider: rule.provider,
      origins: [...rule.origins],
      classifications: [...rule.classifications],
    }));
  }

  checkAiDestination(request: AiDestinationRequest): AiDestinationDecision {
    return decideAiDestination(request);
  }
}
