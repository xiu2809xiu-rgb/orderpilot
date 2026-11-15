import { CircleCheck } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AnimatedList } from "@/components/kit/AnimatedList";
import { EmptyState } from "@/components/parts/EmptyState";
import { Section } from "@/components/parts/Section";
import { HomeQuery } from "./HomeQuery";
import { RowSkeletons } from "./RowSkeletons";

interface BlockSectionProps<T> {
  title: string;
  intro?: string;
  query: {
    isPending: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => unknown;
  };
  items: readonly T[];
  itemKey: (item: T) => string;
  /** A row's content; the section lays the rows out. */
  row: (item: T) => ReactNode;
  empty: { title: string; description: string };
  /** The whole list, when there is more than the rows shown. */
  viewAll?: { to: string; total: number };
}

/**
 * The block that stands where "Needs you" is for a role with no inbox: the
 * same section, the same rows, the same states. A request that is loading
 * shows the shape of its rows, one that failed shows the trace id and a retry,
 * one the role may not read says so, and one with nothing says what that means.
 */
export function BlockSection<T>({
  title,
  intro,
  query,
  items,
  itemKey,
  row,
  empty,
  viewAll,
}: BlockSectionProps<T>) {
  const { t } = useTranslation("directions-home");
  return (
    <Section title={title} intro={intro} work className="min-w-0">
      <HomeQuery query={query} loading={<RowSkeletons rows={5} />}>
        {items.length === 0 ? (
          <EmptyState
            icon={CircleCheck}
            title={empty.title}
            description={empty.description}
          />
        ) : (
          <>
            <AnimatedList className="-my-3 divide-y divide-border">
              {items.map((item) => (
                <Fragment key={itemKey(item)}>{row(item)}</Fragment>
              ))}
            </AnimatedList>
            {viewAll && viewAll.total > items.length ? (
              <p className="fs-14 mt-4 flex justify-end border-t border-border pt-3">
                <Link
                  to={viewAll.to}
                  className="inline-flex items-center font-medium text-ring underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11"
                >
                  {t("block.viewAll", { total: viewAll.total })}
                </Link>
              </p>
            ) : null}
          </>
        )}
      </HomeQuery>
    </Section>
  );
}
