import {
  Check,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleDot,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { STEP_IDS, stateOf, type Flow, type JourneyState } from "./journey";
import "./parts.css";

export type RailSize = "row" | "full" | "vertical";

interface JourneyRailProps {
  flow: Flow;
  /** A row's small rail, a header's full rail, or a timeline's vertical rail. */
  size: RailSize;
  /** The step the order is at, 1 to 9. Past 9 means every step is done. */
  current: number;
  /** The current step has run past its usual time. */
  late?: boolean;
  /** A line under a step, by position: who and when, waiting since, or expected by. */
  details?: Partial<Record<number, string>>;
  className?: string;
}

const ICON: Record<JourneyState, LucideIcon> = {
  done: CircleCheck,
  now: CircleDot,
  later: CircleDashed,
};

/**
 * An order's nine steps as one rail: done, now and later, each with a word and
 * an icon so colour never says it alone. The same markup is small in a list
 * row, full in an order's header and vertical on a timeline; parts.css
 * gives the current step a glow.
 */
export function JourneyRail({
  flow,
  size,
  current,
  late = false,
  details,
  className,
}: JourneyRailProps) {
  const { t } = useTranslation("directions-parts");
  const ids = STEP_IDS[flow];
  const total = ids.length;
  const steps = ids.map((id, index) => {
    const position = index + 1;
    const state = stateOf(position, current);
    const lateNow = late && state === "now";
    return {
      id,
      position,
      state,
      lateNow,
      label: t(`journey.${flow}.${id}`),
      word: t(`journey.state.${lateNow ? "late" : state}`),
      Icon: lateNow ? CircleAlert : ICON[state],
    };
  });
  const name = t(`journey.flows.${flow}`);
  const now = steps.find((step) => step.state === "now");

  if (size === "row") {
    return (
      <div className={cn("jr-row", className)} data-late={late || undefined}>
        <ol className="jr" data-size="row" aria-label={name}>
          {steps.map((step) => (
            <li
              key={step.id}
              className="jr-step"
              data-state={step.state}
              aria-current={step.state === "now" ? "step" : undefined}
            >
              <span className="jr-mark" aria-hidden="true" />
              <span className="sr-only">
                {t("journey.step", { n: step.position, total })}
                {": "}
                {step.label}
                {", "}
                {step.word}
              </span>
            </li>
          ))}
        </ol>
        <span className="jr-now fs-14">
          {now ? (
            <>
              <now.Icon className="size-3.5 shrink-0" aria-hidden="true" />
              {now.label}
            </>
          ) : (
            <>
              <CircleCheck className="size-3.5 shrink-0" aria-hidden="true" />
              {t("journey.complete")}
            </>
          )}
        </span>
      </div>
    );
  }

  return (
    <ol
      className={cn("jr", className)}
      data-size={size}
      aria-label={name}
      data-late={late || undefined}
    >
      {steps.map((step) => (
        <li
          key={step.id}
          className="jr-step"
          data-state={step.state}
          data-late={step.lateNow || undefined}
          aria-current={step.state === "now" ? "step" : undefined}
        >
          <span className="jr-mark" aria-hidden="true">
            <span className="jr-no">{step.position}</span>
            <Check className="jr-check" strokeWidth={2.5} />
          </span>
          <span className="jr-text">
            <span className="jr-label fs-14">
              <step.Icon className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{step.label}</span>
            </span>
            <span className="jr-detail fs-12">
              {details?.[step.position] ? (
                <>
                  <span className="sr-only">{step.word}: </span>
                  {details[step.position]}
                </>
              ) : (
                step.word
              )}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
