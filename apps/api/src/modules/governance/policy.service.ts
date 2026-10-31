import { Injectable } from "@nestjs/common";
import { createSyntheticDataset } from "@orderpilot/synthetic-data";
import type {
  AiDestinationDecision,
  AiDestinationRequest,
  AiDestinationRule,
  Role,
} from "@orderpilot/shared";
import {
  DEFAULT_AI_RULES,
  decideAiDestination,
} from "./domain/ai-destination-policy.js";
import { SAMPLE_RULES, mask } from "./domain/masking.js";
import type { MaskingSampleRecord } from "./governance.schemas.js";

// Neutral notes for the synthetic customers. They are made up, and the sample
// rule hides them from roles that do not need them.
const SAMPLE_NOTES = [
  "Prefers email over phone for confirmations.",
  "Asks for the packing list before each shipment.",
  "Consolidates two orders into one container.",
  "Pays on the first working day of the month.",
] as const;

/**
 * The masking sample and the data-to-AI rules. Masking happens here, on the
 * server: a role the rule does not list receives null, never the note.
 */
@Injectable()
export class PolicyService {
  maskingSample(role: Role) {
    const customers = createSyntheticDataset().customers.slice(
      0,
      SAMPLE_NOTES.length,
    );
    const records: MaskingSampleRecord[] = customers.map((customer, index) => ({
      customerNo: customer.no,
      customerName: customer.name,
      note: mask(
        SAMPLE_RULES,
        role,
        "sample.customerNote",
        SAMPLE_NOTES[index] ?? "",
      ),
    }));
    return {
      data: { rules: [...SAMPLE_RULES], records },
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
