import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Every block is the height of the text it stands for, so that nothing moves
// when the data arrives. The rule for which blocks move: a block that stands for
// a page head, a card, a tile, a chart or a panel shimmers (the band of
// styles/motion.css); the rows of a table or a list, and the cards of a board,
// are `still` grey blocks. CLAUDE.md says never to animate tables or forms while
// they are in use, and a wall of moving rows is not calm.

/** Stands in for PageHeader: a title line and one line of context. */
export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-5 w-96 max-w-full" />
    </div>
  );
}

/** Stands in for SectionCard: the title, then lines of content. */
export function SectionCardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <Card aria-hidden="true">
      <CardHeader>
        <Skeleton className="h-7 w-40" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton key={index} className="h-5 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

/** Stands in for DataTable: the same dense rows and header height. */
export function TableSkeleton({
  columns = 5,
  rows = 8,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border bg-card"
      aria-hidden="true"
    >
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: columns }, (_, index) => (
              <TableHead key={index} className="h-9 px-3">
                <Skeleton still className="h-4 w-20" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, row) => (
            <TableRow key={row} className="hover:bg-transparent">
              {Array.from({ length: columns }, (_, index) => (
                <TableCell key={index} className="px-3 py-2">
                  <Skeleton still className="h-5 w-3/4" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** A whole list page while it loads: header, filter bar and table. */
export function ListPageSkeleton() {
  const { t } = useTranslation("components");
  return (
    <div role="status" aria-busy="true" className="space-y-s4">
      <span className="sr-only">{t("states.loading")}</span>
      <PageHeaderSkeleton />
      <div className="space-y-s2" aria-hidden="true">
        <Skeleton className="h-9 w-full max-w-xs" />
        <TableSkeleton />
      </div>
    </div>
  );
}
