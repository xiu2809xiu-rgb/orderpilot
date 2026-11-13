import { CircleCheck, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  contrast,
  describeColour,
  flatten,
  need,
  parseColor,
  surface,
  type Tokens,
} from "../tokens/contrast";
import { Section } from "../parts/Section";
import { useTokens } from "./useTokens";

const SWATCHES = [
  "background",
  "card",
  "muted",
  "foreground",
  "muted-foreground",
  "faint-foreground",
  "primary",
  "accent",
  "success-surface",
  "warning-surface",
  "destructive-surface",
  "info-surface",
  "border",
  "border-strong",
] as const;

/** Every text colour and the surface it is drawn on. The token test measures the same pairs. */
const PAIRS: readonly [text: string, chain: string[]][] = [
  ["foreground", ["background"]],
  ["foreground", ["card"]],
  ["muted-foreground", ["card"]],
  ["faint-foreground", ["card"]],
  ["primary-foreground", ["primary"]],
  ["accent-foreground", ["accent", "card"]],
  ["success", ["success-surface"]],
  ["warning", ["warning-surface"]],
  ["destructive", ["destructive-surface"]],
  ["info", ["info-surface"]],
];

const NAMES = [
  ...new Set([
    ...SWATCHES,
    ...PAIRS.flatMap(([text, chain]) => [text, ...chain]),
    "ground-image",
  ]),
];

/** "accent over card" as one background: translucent layers first, the base colour last. */
function layered(chain: string[]): string {
  const layers = chain.map((name) => `var(--${name})`);
  const base = layers.pop() ?? "transparent";
  return [
    ...layers.map((layer) => `linear-gradient(${layer}, ${layer})`),
    base,
  ].join(", ");
}

function ratioOf(tokens: Tokens, text: string, chain: string[]): number {
  const under = surface(tokens, chain);
  return contrast(flatten(parseColor(need(tokens, text)), under), under);
}

export function ColourSection() {
  const { t } = useTranslation("directions-kit");
  const tokens = useTokens(NAMES);
  const ready = (tokens.background ?? "") !== "";
  return (
    <Section
      title={t("sections.colour")}
      intro={t("colour.intro")}
      className="lg:col-span-2"
    >
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {SWATCHES.map((name) => (
          <li key={name} className="min-w-0">
            <div
              className="h-12 border"
              style={{
                background: `var(--${name})`,
                borderColor: "var(--border-strong)",
                borderRadius: "var(--radius-control)",
              }}
            />
            <p className="fs-12 mt-1.5 truncate font-medium">--{name}</p>
            <p className="fs-12 numeral break-all text-muted-foreground">
              {ready ? describeColour(tokens[name] ?? "") : ""}
            </p>
          </li>
        ))}
      </ul>
      {ready ? (
        <ul className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-x-8 sm:grid-cols-2">
          {PAIRS.map(([text, chain]) => {
            const ratio = ratioOf(tokens, text, chain);
            const passes = ratio >= 4.5;
            const Icon = passes ? CircleCheck : TriangleAlert;
            return (
              <li
                key={`${text}-${chain.join("-")}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border py-2"
              >
                <span
                  className="fs-14 w-12 shrink-0 py-1 text-center font-semibold"
                  style={{
                    color: `var(--${text})`,
                    background: layered(chain),
                    borderRadius: "var(--radius-control)",
                  }}
                >
                  {t("colour.sample")}
                </span>
                <span className="fs-13 min-w-40 flex-1 break-words">
                  {t("colour.on", {
                    text: `--${text}`,
                    surface: `--${chain[0] ?? ""}`,
                  })}
                </span>
                <span className="fs-13 numeral shrink-0">
                  {t("colour.ratio", { ratio: ratio.toFixed(2) })}
                </span>
                <span
                  className={`fs-12 inline-flex w-28 shrink-0 items-center gap-1 ${passes ? "text-success" : "text-destructive"}`}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {passes ? t("colour.pass") : t("colour.fail")}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Section>
  );
}
