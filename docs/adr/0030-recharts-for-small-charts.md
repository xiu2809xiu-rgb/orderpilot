# ADR 0030: Recharts, through shadcn's chart wrapper, for the small charts

- **Status:** Accepted
- **Date:** 2026-11-01
- **Story:** P-33, home pages that work, for every role (issue 119)

## Context

Management's home page shows Spectra's five measures, each with its current value, its target and a twelve-week trend. The KPI screen (P-38) needs the same trend lines, larger. Until now the web app had no chart library: the insights page draws its bars with plain elements.

A small line with a dashed target line and a tooltip can be drawn by hand in SVG, but each later chart (trends, comparisons, a cost per document in G-1) would then grow its own axis, scale and tooltip code. The story names shadcn's chart component, which is a thin wrapper over Recharts, so the charts share the design tokens and the free kits rule holds.

## Decision

1. **Recharts 3.10.1, pinned exactly** in `apps/web/package.json`. It installed under the workspace's `minimumReleaseAge` of seven days, so it is not a fresh release.
2. **shadcn's chart wrapper, cut down** to `apps/web/src/components/ui/chart.tsx`: `ChartContainer` turns a series config into `--color-<key>` variables on the element's own style, and `ChartTooltipBox` is the tooltip's card. It injects no `<style>` tag, so the content security policy needs no change.
3. **Charts load only in a lazy chunk.** `KpiTrends` is imported with `React.lazy` from the role home page, and only for Management, so Recharts sits in the `KpiTrends` chunk (about 109 KB gzip) and never in the entry bundle. `pnpm budget` reports the initial JS at 240.2 KB gzip, within the 250 KB budget.
4. **Charts do not animate.** `isAnimationActive={false}` on every series and tooltip: work screens stay still, and the only motion on the home page is each KPI number ticking up once, which respects reduced motion.
5. **Colours come from tokens:** the series is `--primary` and the target is `--muted-foreground`, so light and dark themes need nothing extra. Each sparkline is a single series with its name in the card's heading, so it needs no legend, and it carries a text alternative (`role="img"` with the first and last values).

## Consequences

- P-38 reuses `ChartContainer` and `KpiSparkline` for the KPI screen, and any later chart uses the same wrapper.
- A page that imports `@/components/ui/chart` outside a lazy chunk would pull Recharts into the entry bundle. `pnpm budget` in the verify job catches that.
- Recharts depends on a few small packages (such as `d3-scale` and `victory-vendor`); Dependabot groups their updates with the rest.

## Alternatives considered

- **Hand-drawn SVG.** No dependency, but every chart would repeat scale, axis and tooltip code, and the story names shadcn's chart.
- **Chart.js or ECharts.** Canvas-based, so text alternatives and token colours take more work, and shadcn has no wrapper for them.
- **Visx.** Lower level than needed for small trend lines, with more code per chart.
