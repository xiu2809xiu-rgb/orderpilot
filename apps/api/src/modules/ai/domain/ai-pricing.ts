// The cost of a call is an ESTIMATE: tokens times the prices in configuration.
// There is no price table in code, because prices drift and a stale one would
// look like a fact. Money is a bigint count of 1/10,000 USD, like every amount
// in the app (see money.ts in @orderpilot/shared), so no float is involved.

export interface AiPrices {
  /** USD per million input tokens, as a decimal string such as "0.15". */
  readonly inputUsdPerMtok: string;
  readonly outputUsdPerMtok: string;
}

export interface AiTokenFigures {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/** Up to six decimals: provider prices such as 0.075 are common, and 0.000075 per token is the same. */
const PRICE_PATTERN = /^(\d{1,6})(?:\.(\d{1,6}))?$/;
const PRICE_SCALE = 6;
/** Tokens times a price in 1e-6 USD per million tokens, divided by this, gives 1e-4 USD. */
const TO_FOUR_PLACES = 10n ** 8n;
const FOUR_PLACES = 10_000n;

function priceMicros(name: string, price: string): bigint {
  const match = PRICE_PATTERN.exec(price);
  if (!match) throw new RangeError(`${name} is not a plain decimal.`);
  const [, whole = "0", fraction = ""] = match;
  return (
    BigInt(whole) * 10n ** BigInt(PRICE_SCALE) +
    BigInt(fraction.padEnd(PRICE_SCALE, "0"))
  );
}

function tokenCount(name: string, tokens: number): bigint {
  if (!Number.isSafeInteger(tokens) || tokens < 0) {
    throw new RangeError(`${name} must be a non-negative whole number.`);
  }
  return BigInt(tokens);
}

export class AiPricing {
  private readonly inputMicros: bigint;
  private readonly outputMicros: bigint;

  constructor(prices: AiPrices) {
    this.inputMicros = priceMicros("The input price", prices.inputUsdPerMtok);
    this.outputMicros = priceMicros(
      "The output price",
      prices.outputUsdPerMtok,
    );
  }

  /**
   * The estimated cost in USD, as a decimal string with four places such as
   * "0.0003". Rounded half up once, on the sum, so splitting a call into
   * steps never changes the total. The mock is free: nothing was bought.
   */
  estimate(figures: AiTokenFigures, options: { mock: boolean }): string {
    const input = tokenCount("Input tokens", figures.inputTokens);
    const output = tokenCount("Output tokens", figures.outputTokens);
    if (options.mock) return formatFourPlaces(0n);
    const scaled = input * this.inputMicros + output * this.outputMicros;
    const units = (scaled + TO_FOUR_PLACES / 2n) / TO_FOUR_PLACES;
    return formatFourPlaces(units);
  }
}

function formatFourPlaces(units: bigint): string {
  const whole = (units / FOUR_PLACES).toString();
  const fraction = (units % FOUR_PLACES).toString().padStart(4, "0");
  return `${whole}.${fraction}`;
}
