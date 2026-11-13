import { Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  expectedShipDate,
  PURCHASE_STEP_IDS,
  SALES_STEP_IDS,
  statOf,
  usualDuration,
} from "../../data/estimates";
import { STEP_TIMES, STOCK_ANSWER } from "../../data";
import { DueTimer } from "../../parts/DueTimer";
import { EmptyState } from "../../parts/EmptyState";
import { JourneyRail } from "../../parts/JourneyRail";
import { KpiTile } from "../../parts/KpiTile";
import { MaskedValue } from "../../parts/MaskedValue";
import { Section } from "../../parts/Section";
import { SectionHeader } from "../../parts/SectionHeader";
import { StatusTag, type Tone } from "../../parts/StatusTag";
import { ItemCard } from "./ItemCard";

const TONES: readonly Tone[] = ["ok", "waiting", "mismatch", "info"];
/** A fixed clock, so the due times in the sheet say the same thing in every picture. */
const NOW = new Date("2026-11-13T09:00:00.000Z");
const HOUR = 3_600_000;

/** The product parts, each shown live, with the kit items it is built on. */
export function PartsSection() {
  const { t } = useTranslation("directions-kit-items");
  const { t: tp } = useTranslation("directions-parts");
  const built = (...keys: string[]) =>
    t("parts.builtOn", {
      items: keys.map((key) => t(`items.${key}`)).join(", "),
    });

  // What each step usually takes, from the measured step times.
  const usual = (steps: typeof STEP_TIMES.sales, id: string) => {
    const stat = statOf(steps, id);
    if (!stat) return undefined;
    const u = usualDuration(stat);
    return u.kind === "sameDay"
      ? tp("usual.sameDay")
      : tp(`usual.${u.kind}`, { count: u.amount });
  };
  const salesDetails = Object.fromEntries(
    SALES_STEP_IDS.flatMap((id, i) => {
      const text = usual(STEP_TIMES.sales, id);
      return text ? [[i + 1, text]] : [];
    }),
  );
  const purchaseDetails = Object.fromEntries(
    PURCHASE_STEP_IDS.flatMap((id, i) => {
      const text = usual(STEP_TIMES.purchase, id);
      return text ? [[i + 1, text]] : [];
    }),
  );
  const ship = expectedShipDate({
    steps: STEP_TIMES.sales,
    currentStep: "payment",
    enteredOn: STEP_TIMES.source.referenceDate,
    today: STEP_TIMES.source.referenceDate,
  });
  const payment = statOf(STEP_TIMES.sales, "payment");

  return (
    <Section id="kit-parts" title={t("parts.title")} intro={t("parts.intro")}>
      <div className="grid gap-4 lg:grid-cols-3">
        <ItemCard
          name={t("parts.names.journeyRail")}
          note={t("parts.follows")}
          align="start"
          scroll
          className="lg:col-span-3"
        >
          <p className="fs-13 text-muted-foreground">
            {t("parts.demo.journeyFull")}
          </p>
          <JourneyRail
            flow="sales"
            size="full"
            current={4}
            details={salesDetails}
            className="w-full min-w-3xl"
          />
          {ship ? (
            <p className="fs-14 text-foreground">
              {t("parts.demo.shipLine", {
                count: ship.inDays,
                orders: STEP_TIMES.orders,
              })}
            </p>
          ) : null}
        </ItemCard>
        <ItemCard
          name={t("parts.names.journeyRail")}
          note={t("parts.follows")}
          align="start"
        >
          <p className="fs-13 text-muted-foreground">
            {t("parts.demo.journeyVertical")}
          </p>
          <JourneyRail
            flow="purchase"
            size="vertical"
            current={2}
            details={purchaseDetails}
          />
        </ItemCard>
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <ItemCard
              name={t("parts.names.journeyRail")}
              note={t("parts.follows")}
              align="start"
            >
              <p className="fs-13 text-muted-foreground">
                {t("parts.demo.journeyRow")}
              </p>
              <div className="flex flex-col gap-3">
                <JourneyRail flow="sales" size="row" current={2} />
                <JourneyRail flow="sales" size="row" current={5} late />
                <JourneyRail flow="sales" size="row" current={10} />
              </div>
            </ItemCard>
            <ItemCard
              name={t("parts.names.statusChip")}
              note={built("badge")}
              align="start"
            >
              <div className="flex flex-wrap gap-2">
                {TONES.map((tone) => (
                  <StatusTag key={tone} tone={tone} />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <DueTimer due={new Date(NOW.getTime() + 3 * HOUR)} now={NOW} />
                <DueTimer due={new Date(NOW.getTime() + 25 * HOUR)} now={NOW} />
                <DueTimer due={new Date(NOW.getTime() - 50 * HOUR)} now={NOW} />
              </div>
            </ItemCard>
          </div>
          <ItemCard
            name={t("parts.names.kpiTile")}
            note={built(
              "numberTicker",
              "splitFlap",
              "gradientText",
              "spotlightCard",
            )}
            align="start"
          >
            <div className="grid w-full gap-3 sm:grid-cols-3">
              <KpiTile
                label={t("parts.demo.ordersInSet")}
                value={STEP_TIMES.orders}
              />
              <KpiTile
                label={t("parts.demo.daysToPay")}
                value={payment ? payment.median : null}
                unit={t("parts.demo.days")}
              />
              <KpiTile
                label={t("parts.demo.hpAvailable")}
                value={STOCK_ANSWER.totals.available}
                unit={t("parts.demo.units")}
              />
            </div>
          </ItemCard>
        </div>
        <ItemCard
          name={t("parts.names.maskedValue")}
          note={t("parts.alone")}
          align="start"
        >
          <dl className="fs-14 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">
              {t("parts.demo.maskedLabel")}
            </dt>
            <dd>
              <MaskedValue masked reason={t("parts.demo.maskedReason")} />
            </dd>
            <dt className="text-muted-foreground">{t("parts.demo.shown")}</dt>
            <dd>
              <MaskedValue masked={false} value={t("parts.demo.maskedValue")} />
            </dd>
          </dl>
        </ItemCard>
        <ItemCard
          name={t("parts.names.sectionEmpty")}
          note={built("dotPattern", "blurFade")}
          align="start"
          className="lg:col-span-2"
        >
          <div className="w-full">
            <SectionHeader title={t("parts.demo.sectionTitle")} count={0} />
            <EmptyState
              icon={Inbox}
              title={t("parts.demo.emptyTitle")}
              description={t("parts.demo.emptyText")}
              action={
                <Button variant="outline" size="sm">
                  {t("parts.demo.emptyAction")}
                </Button>
              }
              className="w-full"
            />
          </div>
        </ItemCard>
      </div>
    </Section>
  );
}
