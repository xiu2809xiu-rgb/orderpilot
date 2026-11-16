/**
 * What one gateway call has used so far, summed over every provider request
 * it made: retries, tool steps and all. The usage record is written from this,
 * so a call that fails half way still reports the tokens it spent. One meter
 * per call, never shared.
 */
export class AiCallMeter {
  private input = 0;
  private output = 0;
  private made = 0;
  private answered: string | null = null;

  /** One provider request left the process, whatever came back. */
  addRequest(): void {
    this.made += 1;
  }

  addTokens(inputTokens: number, outputTokens: number): void {
    this.input += inputTokens;
    this.output += outputTokens;
  }

  /** The model that answered the latest step, or null while none has. */
  noteModel(model: string): void {
    this.answered = model;
  }

  get model(): string | null {
    return this.answered;
  }

  get inputTokens(): number {
    return this.input;
  }

  get outputTokens(): number {
    return this.output;
  }

  get requests(): number {
    return this.made;
  }
}
