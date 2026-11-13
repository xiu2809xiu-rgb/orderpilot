// Kit: ReUI / timeline. Licence: MIT. Adapted to OrderPilot's tokens.
import { createContext, useContext, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

const Context = createContext(0);
const ItemContext = createContext(false);

/**
 * A vertical record of things that happened, newest or oldest first as the
 * caller orders them. `value` is how many entries are done (filled): the
 * rest are still to come. It is My timeline's skeleton and an order's
 * activity. The parts are ReUI's: item, indicator, separator, header, title,
 * date and content.
 */
export function Timeline({
  value = 0,
  className,
  ...props
}: ComponentProps<"ol"> & { value?: number }) {
  return (
    <Context.Provider value={value}>
      <ol
        data-slot="timeline"
        className={cn("flex flex-col", className)}
        {...props}
      />
    </Context.Provider>
  );
}

export function TimelineItem({
  step,
  className,
  ...props
}: ComponentProps<"li"> & { step: number }) {
  const value = useContext(Context);
  const done = step <= value;
  return (
    <ItemContext.Provider value={done}>
      <li
        data-slot="timeline-item"
        data-completed={done ? "" : undefined}
        className={cn(
          "group/item relative flex flex-col gap-0.5 pb-6 pl-8 last:pb-0",
          className,
        )}
        {...props}
      />
    </ItemContext.Provider>
  );
}

/** The dot on the rail. It is decoration: the title says what happened. */
export function TimelineIndicator({
  className,
  ...props
}: ComponentProps<"span">) {
  const done = useContext(ItemContext);
  return (
    <span
      aria-hidden="true"
      data-slot="timeline-indicator"
      className={cn(
        "absolute top-1 left-0 size-4 rounded-full border-2",
        done ? "border-ring bg-ring" : "border-border-strong bg-background",
        className,
      )}
      {...props}
    />
  );
}

export function TimelineSeparator({
  className,
  ...props
}: ComponentProps<"span">) {
  const done = useContext(ItemContext);
  return (
    <span
      aria-hidden="true"
      data-slot="timeline-separator"
      className={cn(
        "absolute top-6 bottom-0 left-[7px] w-0.5 group-last/item:hidden",
        done ? "bg-ring" : "bg-border",
        className,
      )}
      {...props}
    />
  );
}

export function TimelineHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col", className)} {...props} />;
}

export function TimelineTitle({
  className,
  children,
  ...props
}: ComponentProps<"h3">) {
  return (
    <h3
      data-slot="timeline-title"
      className={cn("fs-14 font-medium text-foreground", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function TimelineDate({ className, ...props }: ComponentProps<"time">) {
  return (
    <time
      data-slot="timeline-date"
      className={cn("numeral fs-13 block text-muted-foreground", className)}
      {...props}
    />
  );
}

export function TimelineContent({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="timeline-content"
      className={cn("fs-13 text-muted-foreground", className)}
      {...props}
    />
  );
}
