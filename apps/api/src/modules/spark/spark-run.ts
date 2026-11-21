import type { SparkSource, SparkStep } from "@orderpilot/shared";

/** The most chips and steps one answer keeps: a row of a table is not a source of its own beyond this. */
const MAX_SOURCES = 20;
const MAX_STEPS = 40;

/**
 * What ONE question's tools did, collected on the server. A run is made for
 * each question and handed to the tools made for it, so it can never be shared
 * between two people or two questions. The model writes the prose and nothing
 * else: the sources and the steps of an answer come from here, never from its
 * words.
 *
 * The sources are what the tools returned, which is what Spark looked at, not
 * proof that the prose used them. Steps come from the gateway's own report of
 * each tool call, so a refused call is in them even though its tool never ran.
 */
export class SparkRun {
  private readonly sourceList: SparkSource[] = [];
  private readonly stepList: SparkStep[] = [];

  /** Adds what a tool looked at, once per record. */
  addSources(sources: readonly SparkSource[]): void {
    for (const source of sources) {
      if (this.sourceList.length >= MAX_SOURCES) return;
      const known = this.sourceList.some(
        (have) => have.kind === source.kind && have.id === source.id,
      );
      if (!known) this.sourceList.push(source);
    }
  }

  noteStep(step: SparkStep): void {
    if (this.stepList.length < MAX_STEPS) this.stepList.push(step);
  }

  get sources(): readonly SparkSource[] {
    return this.sourceList;
  }

  get steps(): readonly SparkStep[] {
    return this.stepList;
  }

  /**
   * Whether one of OUR tools was refused and never ran afterwards. A refusal
   * the model got round (it sent bad arguments, then good ones) is a recovery.
   * One it did not, such as a role that may not use the tool, means the answer
   * was written without what the person asked for, so it is not kept as one.
   * A name the model made up is not one of ours and does not count.
   */
  hasUnresolvedRefusal(toolNames: readonly string[]): boolean {
    return this.stepList.some(
      (step, index) =>
        step.status === "refused" &&
        toolNames.includes(step.tool) &&
        !this.stepList
          .slice(index + 1)
          .some((later) => later.tool === step.tool && later.status === "ran"),
    );
  }
}
