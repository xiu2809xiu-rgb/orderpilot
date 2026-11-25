import { DemoBadge } from "@/components/common";

/**
 * The labels that stop made-up data being mistaken for real. Mock data, where
 * `meta.mock` is true, wears both. An order the state machine runs has a real
 * status, but it is still a synthetic order, so it keeps that label.
 */
export function MockBadges({ mock }: { mock: boolean | undefined }) {
  if (mock === undefined) return null;
  return (
    <span className="flex flex-wrap items-center gap-2">
      {mock ? <DemoBadge kind="mock" /> : null}
      <DemoBadge kind="synthetic" />
    </span>
  );
}
