import { useId, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SectionCardProps {
  title: string;
  description?: string;
  /** Buttons or badges on the right of the title. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A titled block of a page. It is a labelled region, so screen readers can jump to it. */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: SectionCardProps) {
  const headingId = useId();
  return (
    <Card role="region" aria-labelledby={headingId} className={className}>
      <CardHeader className="flex flex-wrap items-start justify-between gap-s2">
        <div className="space-y-1">
          <CardTitle id={headingId} className="text-lg">
            <h2>{title}</h2>
          </CardTitle>
          {description ? (
            <p className="measure text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
