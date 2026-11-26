import type { MasterMatch } from "@orderpilot/shared";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ScrollRegion } from "@/components/common";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusChip } from "@/components/kit/StatusChip";

/**
 * The customer and items as printed on the documents, beside the Business
 * Central record with the same number. Names are shown and never matched on: a
 * look-alike is a possible match for a person to look at.
 */
export function ChecksMatches({
  matches,
}: {
  matches: readonly MasterMatch[];
}) {
  const { t } = useTranslation("order-tracker");
  return (
    <ScrollRegion
      label={t("detail.matches.region")}
      className="od-lines-scroll"
    >
      <Table className="od-table od-lines">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col">{t("detail.matches.kind")}</TableHead>
            <TableHead scope="col">{t("detail.matches.printed")}</TableHead>
            <TableHead scope="col">{t("detail.matches.matched")}</TableHead>
            <TableHead scope="col">{t("detail.matches.possible")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matches.map((match) => (
            <TableRow key={`${match.kind}-${match.printedNo}`}>
              <TableCell>{t(`detail.matches.${match.kind}`)}</TableCell>
              <TableCell>
                <span className="od-customer">
                  <span className="od-customer-name">{match.printedName}</span>
                  <span className="numeral od-customer-no">
                    {match.printedNo}
                  </span>
                </span>
              </TableCell>
              <TableCell>
                {match.matchedNo ? (
                  <span className="od-customer">
                    <span className="od-customer-name">
                      {match.matchedName}
                    </span>
                    <span className="numeral od-customer-no">
                      {match.matchedNo}
                    </span>
                  </span>
                ) : (
                  <StatusChip kind="warning" icon={TriangleAlert}>
                    {t("detail.matches.noMatch")}
                  </StatusChip>
                )}
              </TableCell>
              <TableCell className="fs-14 text-muted-foreground">
                {match.possibleMatches.length === 0
                  ? t("detail.matches.none")
                  : match.possibleMatches
                      .map((possible) => `${possible.no} ${possible.name}`)
                      .join("; ")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollRegion>
  );
}
