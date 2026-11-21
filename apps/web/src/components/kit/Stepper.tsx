// Kit: ReUI / stepper. Licence: MIT. Adapted to OrderPilot's tokens.
import { Check } from "lucide-react";
import { createContext, useContext, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Orientation = "horizontal" | "vertical";
type StepState = "completed" | "active" | "inactive";

/** The words that say each state, so colour never carries it alone. */
export interface StepperLabels {
  completed: string;
  active: string;
  inactive: string;
}

interface StepperContext {
  value: number;
  orientation: Orientation;
  labels: StepperLabels;
}
const Context = createContext<StepperContext | null>(null);
const ItemContext = createContext<{ state: StepState; step: number } | null>(
  null,
);

function useStepper(): StepperContext {
  const value = useContext(Context);
  if (!value) throw new Error("Stepper parts must sit inside a Stepper");
  return value;
}
function useItem() {
  const value = useContext(ItemContext);
  if (!value) throw new Error("Stepper parts must sit inside a StepperItem");
  return value;
}

type StepperProps = Omit<ComponentProps<"ol">, "aria-label"> & {
  /** The step the work is at: earlier steps are done, later ones wait. */
  value: number;
  orientation?: Orientation;
  /** The name of the whole list, for example "Order journey". */
  label: string;
  labels: StepperLabels;
};

/**
 * Steps in order, each done, current or later. ReUI's stepper is a tablist
 * that a person clicks through; the journey of an order is a read-out, so
 * this one is an ordered list whose current step carries `aria-current`. The
 * parts (item, indicator, title, description, separator) are ReUI's.
 */
export function Stepper({
  value,
  orientation = "horizontal",
  label,
  labels,
  className,
  ...props
}: StepperProps) {
  return (
    <Context.Provider value={{ value, orientation, labels }}>
      <ol
        aria-label={label}
        data-slot="stepper"
        data-orientation={orientation}
        className={cn(
          "group/stepper flex w-full",
          orientation === "horizontal" ? "flex-row" : "flex-col",
          className,
        )}
        {...props}
      />
    </Context.Provider>
  );
}

export function StepperItem({
  step,
  className,
  ...props
}: ComponentProps<"li"> & { step: number }) {
  const { value } = useStepper();
  const state: StepState =
    step < value ? "completed" : step === value ? "active" : "inactive";
  return (
    <ItemContext.Provider value={{ state, step }}>
      <li
        data-slot="stepper-item"
        data-state={state}
        aria-current={state === "active" ? "step" : undefined}
        className={cn(
          "group/step relative flex min-w-0 group-data-[orientation=horizontal]/stepper:flex-1 group-data-[orientation=horizontal]/stepper:flex-col group-data-[orientation=horizontal]/stepper:gap-2 group-data-[orientation=vertical]/stepper:flex-row group-data-[orientation=vertical]/stepper:gap-3 group-data-[orientation=vertical]/stepper:pb-5 group-data-[orientation=vertical]/stepper:last:pb-0",
          className,
        )}
        {...props}
      />
    </ItemContext.Provider>
  );
}

/** The numbered disc: a check when done, the number otherwise. */
export function StepperIndicator({ className }: { className?: string }) {
  const { state, step } = useItem();
  const { labels } = useStepper();
  return (
    <span
      data-slot="stepper-indicator"
      data-state={state}
      className={cn(
        "numeral fs-14 relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border",
        state === "completed" &&
          "border-ring bg-primary text-primary-foreground",
        state === "active" && "border-ring bg-background text-ring",
        state === "inactive" && "border-border bg-muted text-muted-foreground",
        className,
      )}
    >
      {state === "completed" ? (
        <Check aria-hidden="true" className="size-4" />
      ) : (
        <span aria-hidden="true">{step}</span>
      )}
      <span className="sr-only">{labels[state]}</span>
    </span>
  );
}

export function StepperTitle({ className, ...props }: ComponentProps<"span">) {
  const { state } = useItem();
  return (
    <span
      data-slot="stepper-title"
      className={cn(
        "fs-14 block font-medium",
        state === "inactive" ? "text-muted-foreground" : "text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function StepperDescription({
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      data-slot="stepper-description"
      className={cn("fs-14 block text-muted-foreground", className)}
      {...props}
    />
  );
}

/** The line to the next step: filled once this step is done. */
export function StepperSeparator({ className }: { className?: string }) {
  const { state } = useItem();
  return (
    <span
      aria-hidden="true"
      data-slot="stepper-separator"
      className={cn(
        "absolute rounded-full group-last/step:hidden",
        "group-data-[orientation=horizontal]/stepper:top-3.5 group-data-[orientation=horizontal]/stepper:left-9 group-data-[orientation=horizontal]/stepper:h-0.5 group-data-[orientation=horizontal]/stepper:right-2",
        "group-data-[orientation=vertical]/stepper:top-8 group-data-[orientation=vertical]/stepper:bottom-1 group-data-[orientation=vertical]/stepper:left-3.5 group-data-[orientation=vertical]/stepper:w-0.5",
        state === "completed" ? "bg-ring" : "bg-border",
        className,
      )}
    />
  );
}
