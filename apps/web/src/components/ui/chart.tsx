import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = Record<string, { label: string; color: string }>;

/**
 * shadcn's chart wrapper, cut down to what the charts here use. Each series in
 * `config` becomes a `--color-<key>` variable, so a chart says
 * `stroke="var(--color-value)"` and follows the theme's tokens. The variables
 * go on the element's style, not in a <style> tag, so nothing is injected.
 */
export function ChartContainer({
  config,
  className,
  children,
}: {
  config: ChartConfig;
  className?: string;
  children: ComponentProps<typeof ResponsiveContainer>["children"];
}) {
  const colours = Object.fromEntries(
    Object.entries(config).map(([key, entry]) => [
      `--color-${key}`,
      entry.color,
    ]),
  ) as CSSProperties;
  return (
    <div data-slot="chart" style={colours} className={cn("w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export const ChartTooltip = Tooltip;

/** The tooltip's card. Text keeps the text tokens; the mark carries the colour. */
export function ChartTooltipBox({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md">
      <p className="text-muted-foreground">{title}</p>
      <p className="font-medium tabular-nums">{children}</p>
    </div>
  );
}
