import { DemoBadge } from "@/components/common";

/** The labels that stop mock, made-up data being mistaken for real. Shown where `meta.mock` is true. */
export function MockBadges({ mock }: { mock: boolean | undefined }) {
  if (!mock) return null;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <DemoBadge kind="mock" />
      <DemoBadge kind="synthetic" />
    </span>
  );
}
