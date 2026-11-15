import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/parts/PageHeader";
import { Section } from "@/components/parts/Section";

/**
 * The anatomy of a page that says what happened instead of showing records:
 * not found, no access, an error. The page head says it in plain words with
 * the one next action beside it, and a section below holds the fact a person
 * can use (the address they opened, the role they have, the reference to quote).
 */
export function StatusPage({
  icon: Icon,
  title,
  intro,
  actions,
  sectionTitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  intro: string;
  /** The next action. One button is the primary one. */
  actions: ReactNode;
  sectionTitle: string;
  children: ReactNode;
}) {
  return (
    <div className="max-w-3xl">
      <PageHeader title={title} intro={intro} actions={actions} />
      <Section title={sectionTitle}>
        <div className="flex items-start gap-4">
          <span
            className="flex size-12 shrink-0 items-center justify-center border border-border-strong bg-card text-ring"
            style={{ borderRadius: "var(--radius-control)" }}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 space-y-2">{children}</div>
        </div>
      </Section>
    </div>
  );
}
