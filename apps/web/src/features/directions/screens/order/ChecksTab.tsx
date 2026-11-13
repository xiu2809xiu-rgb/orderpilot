import type { CheckResult, MasterMatch } from "@orderpilot/shared";
import { CircleCheck, ShieldCheck, TriangleAlert } from "lucide-react";
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
import { StatusChip } from "../../kit/StatusChip";
import { EmptyState } from "../../parts/EmptyState";

function Result({ check }: { check: CheckResult }) {
  const { t } = useTranslation("order-tracker");
  const pass = check.outcome === "pass";
  return (
    <li className="od-check">
      <div className="od-check-head">
        <StatusChip
          kind={pass ? "success" : "destructive"}
          icon={pass ? CircleCheck : TriangleAlert}
        >
          {t(`detail.checks.${check.outcome}`)}
        </StatusChip>
        <h4 className="fs-14 font-medium text-foreground">{check.ruleLabel}</h4>
      </div>
      <dl className="od-check-facts fs-13">
        <div>
          <dt className="text-muted-foreground">
            {t("detail.checks.expected")}
          </dt>
          <dd className="numeral">{check.expected}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("detail.checks.found")}</dt>
          <dd className="numeral">{check.actual}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            {t("detail.checks.tolerance")}
          </dt>
          <dd>
            {check.tolerance.label}:{" "}
            <span className="numeral">{check.tolerance.value}</span>
          </dd>
        </div>
      </dl>
      {check.evidence.length > 0 ? (
        <p className="fs-13 text-muted-foreground">
          {t("detail.checks.evidence")}:{" "}
          {check.evidence
            .map(
              (e) =>
                `${e.documentType.replaceAll("_", " ").toLowerCase()}, ${e.location}`,
            )
            .join("; ")}
        </p>
      ) : null}
    </li>
  );
}

function Matches({ matches }: { matches: readonly MasterMatch[] }) {
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
              <TableCell className="fs-13 text-muted-foreground">
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

/**
 * What the rules found on this order: each check with what was expected, what
 * was found, the tolerance and the evidence, then the customer and items as
 * printed on the documents beside the Business Central record with the same
 * number. Names are shown and never matched on: a look-alike is a possible
 * match for a person to look at. Both come from the tracker, as the old order
 * page showed them.
 */
export function ChecksTab({
  checks,
  matches,
}: {
  checks: readonly CheckResult[];
  matches: readonly MasterMatch[];
}) {
  const { t } = useTranslation("directions-orders");
  return (
    <div className="od-checks">
      {checks.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={t("order.checks.emptyTitle")}
          description={t("order.checks.emptyBody")}
        />
      ) : (
        <ul className="od-check-list">
          {checks.map((check) => (
            <Result key={check.id} check={check} />
          ))}
        </ul>
      )}
      {matches.length > 0 ? (
        <section aria-labelledby="od-matches" className="od-matches">
          <h3 id="od-matches" className="fs-14 font-semibold">
            {t("order.checks.matches")}
          </h3>
          <Matches matches={matches} />
        </section>
      ) : null}
    </div>
  );
}
