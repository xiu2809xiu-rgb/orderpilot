import type {
  CheckResult,
  DocumentType,
  Order,
  Tolerance,
} from "@orderpilot/shared";

/** What a rule is given when it runs. Everything it needs, nothing it must fetch. */
export interface CheckRuleContext {
  /** The order with its header, lines and documents. Match on Navision numbers, never names. */
  readonly order: Order;
  /** The document whose confirmed fields triggered this run. */
  readonly trigger: DocumentType;
  /** The rule's tolerance. It is configuration, so it arrives here and is echoed in the result. */
  readonly tolerance: Tolerance;
  readonly now: Date;
}

/**
 * The Strategy for one check. A rule says which documents it applies to and
 * how to judge them; the engine (area 3 writes it) runs every rule that
 * applies and collects the results. A new rule is a new class that implements
 * this interface: the engine does not change.
 *
 * A rule is a fixed rule, never AI. It returns pass or fail with what it
 * expected, what it found, the tolerance and the evidence. It does not decide
 * what a failure blocks: the result is reported to area 2 (`check.completed`,
 * see `checkCompletedSchema`), whose state machine decides.
 *
 * The base ships no rule. Writing them, and choosing their tolerances, is
 * area 3's work.
 */
export interface CheckRule {
  /** Stable, unique and lower-case with dots, such as `packing.quantity`. */
  readonly id: string;
  /** Plain words for the screens. */
  readonly label: string;
  /** The documents whose confirmed fields make this rule run. */
  readonly appliesTo: readonly DocumentType[];
  evaluate(context: CheckRuleContext): CheckResult | Promise<CheckResult>;
}
