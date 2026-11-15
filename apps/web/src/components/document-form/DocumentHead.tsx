import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import {
  DemoBadge,
  PageHeader,
  StatusChip,
  type DemoBadgeKind,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import type { DocumentStatus } from "./types";

interface DocumentHeadProps {
  title: string;
  description?: string | undefined;
  back?: { to: string; label: string } | undefined;
  demo?: DemoBadgeKind | undefined;
  /** Absent while the record is not in hand: there is nothing to be in a state. */
  status?: DocumentStatus | undefined;
  headingLevel?: 1 | 2 | undefined;
}

/**
 * The head of the page, in the order page's anatomy: the way back, then the
 * title with the demo label and the status beside it, then one line of
 * context. The status is here and not at the foot, where it was out of sight
 * on a long form; the chip says a word and shows an icon, never colour alone.
 */
export function DocumentHead({
  title,
  description,
  back,
  demo,
  status,
  headingLevel,
}: DocumentHeadProps) {
  const meta =
    demo || status ? (
      <>
        {demo ? <DemoBadge kind={demo} /> : null}
        {status ? (
          <StatusChip family={status.family}>{status.label}</StatusChip>
        ) : null}
      </>
    ) : null;
  return (
    <div className="df-head">
      {back ? (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="df-back pointer-coarse:h-11"
        >
          <Link to={back.to}>
            <ArrowLeft aria-hidden="true" />
            {back.label}
          </Link>
        </Button>
      ) : null}
      <PageHeader
        title={title}
        {...(description ? { description } : {})}
        headingLevel={headingLevel ?? 1}
        meta={meta}
      />
    </div>
  );
}
