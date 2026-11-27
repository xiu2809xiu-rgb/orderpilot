import { useState } from "react";
import { Link } from "react-router";
import type { CheckResult, MasterMatch } from "@orderpilot/shared";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Hourglass,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/kit/Badge";
import { StatusChip, type StatusKind } from "@/components/kit/StatusChip";
import { EmptyState } from "@/components/parts/EmptyState";
import { MaskedValue } from "@/components/parts/MaskedValue";
import { UPLOAD_PATH, useUploadEntry } from "@/app/shell/demoParts";
import { formatMoney } from "@/lib/format";
import { isPriceCheck } from "./priceChecks";

/** "USD 90.48": the currency a small muted prefix, as every money figure prints. */
function Money({ value }: { value: string }) {
  const [currency = "", figure = ""] = formatMoney(value).split(" ");
  return (
    <span className="numeral od-amount">
      <span className="od-cur">{currency}</span> {figure}
    </span>
  );
}

const OUTCOME_ICON = {
  pass: CircleCheck,
  fail: TriangleAlert,
  pending: Hourglass,
  overdue: TriangleAlert,
} as const;

const OUTCOME_KIND: Record<CheckResult["outcome"], StatusKind> = {
  pass: "success",
  fail: "destructive",
  pending: "warning",
  overdue: "destructive",
};

/** A check's title, when it names the two documents it compares by number. */
function PairTitle({ pair }: { pair: NonNullable<CheckResult["pair"]> }) {
  return (
    <span className="od-check-pair">
      <span className="od-check-pair-doc">
        {pair.from.label}
        {pair.from.number ? (
          <Badge variant="outline" className="numeral od-check-doc-no">
            {pair.from.number}
          </Badge>
        ) : null}
      </span>
      <ArrowLeftRight aria-hidden="true" className="od-check-pair-arrow" />
      <span className="od-check-pair-doc">
        {pair.to.label}
        {pair.to.number ? (
          <Badge variant="outline" className="numeral od-check-doc-no">
            {pair.to.number}
          </Badge>
        ) : null}
      </span>
    </span>
  );
}

/** One row of a document cross-check's line table, item against item. */
function LineRow({
  line,
  showQuantity,
  showPrice,
  hidden,
  priceMask,
}: {
  line: NonNullable<CheckResult["lines"]>[number];
  showQuantity: boolean;
  showPrice: boolean;
  hidden: boolean;
  priceMask: string | null;
}) {
  const { t } = useTranslation("order-tracker");
  const quantity = (value: string | null, differs: boolean) => {
    if (value === null) return null;
    if (hidden) return <MaskedValue masked reason={priceMask} />;
    return (
      <span
        className={differs ? "numeral text-warning font-semibold" : "numeral"}
      >
        {value}
      </span>
    );
  };
  const price = (value: string | null, differs: boolean) => {
    if (value === null) return null;
    if (hidden) return <MaskedValue masked reason={priceMask} />;
    return (
      <span className={differs ? "text-warning font-semibold" : undefined}>
        <Money value={value} />
      </span>
    );
  };
  // Only the one side that differs from the PO's own value is called out: a
  // quantity that still matches keeps its plain weight even on a line a
  // price alone has failed.
  const itemDiffers =
    line.toItemNo !== line.fromItemNo ||
    line.toDescription !== line.fromDescription;
  const quantityDiffers =
    line.toQuantity !== null &&
    Number(line.toQuantity) !== Number(line.fromQuantity);
  const priceDiffers =
    line.toPrice !== null && Number(line.toPrice) !== Number(line.fromPrice);
  return (
    <TableRow data-outcome={line.matched ? "pass" : "fail"}>
      <TableCell className="od-check-item-cell">
        <span className="od-check-item-name">{line.fromDescription}</span>
        <span className="numeral od-check-item-no">{line.fromItemNo}</span>
      </TableCell>
      <TableCell className="od-check-item-cell">
        <span
          className={
            itemDiffers
              ? "od-check-item-name text-warning font-semibold"
              : "od-check-item-name"
          }
        >
          {line.toDescription}
        </span>
        <span
          className={
            itemDiffers
              ? "numeral od-check-item-no text-warning font-semibold"
              : "numeral od-check-item-no"
          }
        >
          {line.toItemNo}
        </span>
      </TableCell>
      {showQuantity ? (
        <>
          <TableCell>{quantity(line.fromQuantity, false)}</TableCell>
          <TableCell>{quantity(line.toQuantity, quantityDiffers)}</TableCell>
        </>
      ) : null}
      {showPrice ? (
        <>
          <TableCell>{price(line.fromPrice, false)}</TableCell>
          <TableCell>{price(line.toPrice, priceDiffers)}</TableCell>
        </>
      ) : null}
      <TableCell
        className={line.matched ? "text-success" : "text-warning font-semibold"}
        data-outcome={line.matched ? "pass" : "fail"}
      >
        {line.matched
          ? t("detail.checks.lineMatch")
          : (line.action ?? t("detail.checks.lineMismatch"))}
      </TableCell>
    </TableRow>
  );
}

/**
 * The item-by-item table a document cross-check shows in place of a single
 * result row. `lineValue: "amount"` (a check that compares what two
 * documents bill, not what they ship) prints only the money column; every
 * other check prints the quantity column, and the money one too where a line
 * carries a price.
 */
function LineTable({
  check,
  priceMask,
}: {
  check: CheckResult;
  priceMask: string | null;
}) {
  const { t } = useTranslation("order-tracker");
  const lines = check.lines ?? [];
  const pair = check.pair;
  const isAmount = check.lineValue === "amount";
  const showQuantity = !isAmount;
  const showPrice = isAmount || lines.some((line) => line.fromPrice !== null);
  const valueKey = isAmount ? "amount" : "price";
  const hidden = priceMask !== null && isPriceCheck(check);
  const fromShort = pair?.from.shortLabel ?? "";
  const toShort = pair?.to.shortLabel ?? "";
  return (
    <div className="od-check-table-scroll">
      <Table className="od-table od-check-table">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col">
              {t("detail.checks.item", { doc: fromShort })}
            </TableHead>
            <TableHead scope="col">
              {t("detail.checks.item", { doc: toShort })}
            </TableHead>
            {showQuantity ? (
              <>
                <TableHead scope="col">
                  {t("detail.checks.qty", { doc: fromShort })}
                </TableHead>
                <TableHead scope="col">
                  {t("detail.checks.qty", { doc: toShort })}
                </TableHead>
              </>
            ) : null}
            {showPrice ? (
              <>
                <TableHead scope="col">
                  {t(`detail.checks.${valueKey}`, { doc: fromShort })}
                </TableHead>
                <TableHead scope="col">
                  {t(`detail.checks.${valueKey}`, { doc: toShort })}
                </TableHead>
              </>
            ) : null}
            <TableHead scope="col">{t("detail.checks.result")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => (
            <LineRow
              key={line.fromItemNo}
              line={line}
              showQuantity={showQuantity}
              showPrice={showPrice}
              hidden={hidden}
              priceMask={priceMask}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** The field-by-field table a check that compares two documents by what each prints, not by item, shows. */
function FieldTable({ check }: { check: CheckResult }) {
  const { t } = useTranslation("order-tracker");
  const fields = check.fields ?? [];
  const pair = check.pair;
  return (
    <div className="od-check-table-scroll">
      <Table className="od-table od-check-table">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col">{t("detail.checks.field")}</TableHead>
            <TableHead scope="col">
              {t("detail.checks.onDoc", {
                doc: pair?.from.number ?? pair?.from.label ?? "",
              })}
            </TableHead>
            <TableHead scope="col">
              {t("detail.checks.onDoc", {
                doc: pair?.to.number ?? pair?.to.label ?? "",
              })}
            </TableHead>
            <TableHead scope="col">{t("detail.checks.result")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((field) => (
            <TableRow
              key={field.label}
              data-outcome={field.matched ? "pass" : "fail"}
            >
              <TableCell className="font-medium">{field.label}</TableCell>
              <TableCell>{field.fromValue}</TableCell>
              <TableCell
                className={
                  field.matched ? undefined : "text-warning font-semibold"
                }
              >
                {field.toValue}
              </TableCell>
              <TableCell
                className={
                  field.matched ? "text-success" : "text-warning font-semibold"
                }
                data-outcome={field.matched ? "pass" : "fail"}
              >
                {field.matched
                  ? t("detail.checks.lineMatch")
                  : (field.action ?? t("detail.checks.lineMismatch"))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** The single expected/found/tolerance row a check with no line table falls back to. */
function LegacyTable({
  check,
  priceMask,
}: {
  check: CheckResult;
  priceMask: string | null;
}) {
  const { t } = useTranslation("order-tracker");
  const hidden = priceMask !== null && isPriceCheck(check);
  const figure = (value: string) =>
    hidden ? (
      <MaskedValue masked reason={priceMask} />
    ) : (
      <span className="numeral">{value}</span>
    );
  return (
    <>
      <table className="od-check-legacy-table fs-14">
        <thead>
          <tr>
            <th scope="col">{t("detail.checks.expected")}</th>
            <th scope="col">{t("detail.checks.found")}</th>
            <th scope="col">{t("detail.checks.tolerance")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{figure(check.expected)}</td>
            <td>{figure(check.actual)}</td>
            <td>
              {check.tolerance.label}: {figure(check.tolerance.value)}
            </td>
          </tr>
        </tbody>
      </table>
      {check.evidence.length > 0 ? (
        // Only the document and the place are listed, never the value read there.
        <p className="fs-14 text-muted-foreground">
          {t("detail.checks.evidence")}:{" "}
          {check.evidence
            .map(
              (e) =>
                `${e.documentType.replaceAll("_", " ").toLowerCase()}, ${e.location}`,
            )
            .join("; ")}
        </p>
      ) : null}
    </>
  );
}

/**
 * One line under a failed document cross-check's title: the two sides' own
 * values, with the one that differs called out, and a short note of which
 * item and field.
 */
function MismatchLine({
  mismatch,
}: {
  mismatch: NonNullable<CheckResult["mismatches"]>[number];
}) {
  const money = mismatch.unit === "money";
  return (
    <p className="fs-14 od-check-summary od-check-mismatch">
      <span className="text-muted-foreground">{mismatch.fromLabel}: </span>
      <span className={money ? "font-semibold" : "numeral font-semibold"}>
        {money ? <Money value={mismatch.fromValue} /> : mismatch.fromValue}
      </span>
      <span aria-hidden="true" className="od-check-mismatch-sign">
        {"\u2260"}
      </span>
      <span className="text-muted-foreground">{mismatch.toLabel}: </span>
      <span
        className={
          money
            ? "font-semibold text-warning"
            : "numeral font-semibold text-warning"
        }
      >
        {money ? <Money value={mismatch.toValue} /> : mismatch.toValue}
      </span>
      <span className="text-muted-foreground">
        {" "}
        {"\u00b7"} {mismatch.note}
      </span>
    </p>
  );
}

/**
 * How many of a long list of notes this one line names before it stops and
 * says "and N more": enough to be useful, short enough that the line never
 * grows past a card's own width, whatever the count.
 */
const MISMATCH_NOTES_SHOWN = 3;

/**
 * Every mismatch under a failed document cross-check's title. One line names
 * it in full, the way the title line always has. More than one would not fit
 * a card's one line, so the card instead says how many there are and what
 * the first few are, in the detail line's own order, with the rest folded
 * into "and N more": the full list, one row each, is still in the table
 * below, this line is only ever a count and a sample of it.
 */
function MismatchLines({
  mismatches,
}: {
  mismatches: NonNullable<CheckResult["mismatches"]>;
}) {
  const { t } = useTranslation("order-tracker");
  if (mismatches.length === 1) {
    const [only] = mismatches;
    return only ? <MismatchLine mismatch={only} /> : null;
  }
  const shown = mismatches.slice(0, MISMATCH_NOTES_SHOWN);
  const more = mismatches.length - shown.length;
  const notes = shown.map((mismatch) => mismatch.note).join("; ");
  return (
    <p className="fs-14 od-check-summary od-check-mismatch">
      <span className="font-semibold text-warning">
        {t("detail.checks.mismatchCount", { count: mismatches.length })}
      </span>
      <span className="text-muted-foreground">
        {t(
          more > 0
            ? "detail.checks.mismatchNotesMore"
            : "detail.checks.mismatchNotes",
          { notes, more },
        )}
      </span>
    </p>
  );
}

/**
 * One check, as a card: its name (or, for a document cross-check, the two
 * documents it compares) on the left, its outcome chip on the right, and
 * either a "Details" disclosure or, while a document it needs has not come
 * and this role may upload one, an upload button in its place. A role with
 * no upload permission sees the chip alone: offering an action nobody but
 * someone who can use it would see it as broken, not as an invitation. The
 * figures stay in the markup whether a card is open or closed, open by
 * default, so collapsing one never drops its evidence or its mask.
 */
function Result({
  check,
  priceMask,
}: {
  check: CheckResult;
  priceMask: string | null;
}) {
  const { t } = useTranslation("order-tracker");
  const canUpload = useUploadEntry();
  const [open, setOpen] = useState(true);
  const Icon = OUTCOME_ICON[check.outcome];
  const kind = check.chipKind ?? OUTCOME_KIND[check.outcome];
  const label = check.statusLabel ?? t(`detail.checks.${check.outcome}`);
  const panelId = `od-check-panel-${check.id}`;
  const summaryTone =
    check.outcome === "overdue"
      ? "danger"
      : check.outcome === "pending"
        ? "warning"
        : undefined;
  return (
    <li className="od-check" data-outcome={check.outcome}>
      <div className="od-check-head">
        <div className="od-check-title-col">
          <h3 className="fs-14 font-semibold text-foreground od-check-title">
            {check.pair ? <PairTitle pair={check.pair} /> : check.ruleLabel}
          </h3>
          {check.mismatches && check.mismatches.length > 0 ? (
            <MismatchLines mismatches={check.mismatches} />
          ) : check.summary ? (
            <p className="fs-14 od-check-summary" data-tone={summaryTone}>
              {check.summary}
            </p>
          ) : null}
        </div>
        <div className="od-check-actions">
          <StatusChip kind={kind} icon={Icon}>
            {label}
          </StatusChip>
          {check.upload ? (
            canUpload ? (
              <Button asChild size="sm" className="od-check-upload">
                <Link to={UPLOAD_PATH}>{check.upload.label}</Link>
              </Button>
            ) : null
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => {
                setOpen((value) => !value);
              }}
            >
              {t("detail.checks.details")}
              {open ? <ChevronUp /> : <ChevronDown />}
            </Button>
          )}
        </div>
      </div>
      {check.upload ? null : (
        <div
          id={panelId}
          className="od-check-body"
          hidden={!open}
          data-open={open}
        >
          {check.fields && check.fields.length > 0 ? (
            <FieldTable check={check} />
          ) : check.lines && check.lines.length > 0 ? (
            <LineTable check={check} priceMask={priceMask} />
          ) : (
            <LegacyTable check={check} priceMask={priceMask} />
          )}
        </div>
      )}
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

/**
 * What the rules found on this order: each check with what was expected, what
 * was found, the tolerance and the evidence, then the customer and items as
 * printed on the documents beside the Business Central record with the same
 * number. A check in the "document-cross-check" group compares two documents
 * by number and, where the data has it, item by item; those group under their
 * own "Document Cross-Checks" heading, the rest stay a flat list. Names are
 * shown and never matched on: a look-alike is a possible match for a person
 * to look at. Both come from the tracker, as the old order page showed them.
 * For a role whose prices are masked, a price check shows the mask in place
 * of its figures (see `Result`).
 */
export function ChecksTab({
  checks,
  matches,
  priceMask,
}: {
  checks: readonly CheckResult[];
  matches: readonly MasterMatch[];
  /** Why the order's amount is masked for this role, or null when it may see prices. */
  priceMask: string | null;
}) {
  const { t } = useTranslation("directions-orders");
  const documentCrossChecks = checks.filter(
    (check) => check.group === "document-cross-check",
  );
  const otherChecks = checks.filter(
    (check) => check.group !== "document-cross-check",
  );
  return (
    <div className="od-checks">
      {checks.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={t("order.checks.emptyTitle")}
          description={t("order.checks.emptyBody")}
        />
      ) : (
        <>
          {otherChecks.length > 0 ? (
            <ul className="od-check-list">
              {otherChecks.map((check) => (
                <Result key={check.id} check={check} priceMask={priceMask} />
              ))}
            </ul>
          ) : null}
          {documentCrossChecks.length > 0 ? (
            <section aria-labelledby="od-document-cross-checks">
              <h3
                id="od-document-cross-checks"
                className="fs-14 font-semibold od-checks-group-title"
              >
                {t("order.checks.documentCrossChecks")}
              </h3>
              <ul className="od-check-list">
                {documentCrossChecks.map((check) => (
                  <Result key={check.id} check={check} priceMask={priceMask} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
      {matches.length > 0 ? (
        <section aria-labelledby="od-matches" className="od-matches">
          <div className="od-check-head">
            <h3 id="od-matches" className="fs-14 font-semibold od-check-title">
              {t("order.checks.matches")}
            </h3>
          </div>
          <Matches matches={matches} />
        </section>
      ) : null}
    </div>
  );
}
