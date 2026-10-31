import { useTranslation } from "react-i18next";
import type { MasterMatch } from "@orderpilot/shared";
import { ScrollRegion, SectionCard, StatusBadge } from "@/components/common";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * The customer and items as printed on the documents, beside the master-data
 * record found by the same Navision number. Names are shown, never matched.
 * A look-alike name with another number is a possible match for a person.
 */
export function MasterMatches({
  matches,
}: {
  matches: readonly MasterMatch[];
}) {
  const { t } = useTranslation("order-tracker");
  return (
    <SectionCard
      title={t("detail.matches.title")}
      description={t("detail.matches.description")}
    >
      <ScrollRegion label={t("detail.matches.region")}>
        <Table>
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
                  <span className="font-mono">{match.printedNo}</span>
                  <br />
                  <span className="text-muted-foreground">
                    {match.printedName}
                  </span>
                </TableCell>
                <TableCell>
                  {match.matchedNo ? (
                    <>
                      <span className="font-mono">{match.matchedNo}</span>
                      <br />
                      <span className="text-muted-foreground">
                        {match.matchedName}
                      </span>
                    </>
                  ) : (
                    <StatusBadge tone="warning">
                      {t("detail.matches.noMatch")}
                    </StatusBadge>
                  )}
                </TableCell>
                <TableCell>
                  {match.possibleMatches.length === 0 ? (
                    <span className="text-muted-foreground">
                      {t("detail.matches.none")}
                    </span>
                  ) : (
                    <ul className="space-y-1">
                      {match.possibleMatches.map((possible) => (
                        <li key={possible.no}>
                          <span className="font-mono">{possible.no}</span>{" "}
                          {possible.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollRegion>
    </SectionCard>
  );
}
