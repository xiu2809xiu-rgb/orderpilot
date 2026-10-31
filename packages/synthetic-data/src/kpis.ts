import { addDays, mondayOf } from "./dates.js";
import type { SeededRandom } from "./random.js";
import type {
  KpiSeries,
  SampleOrder,
  SampleSpr,
  WeeklyValue,
} from "./types.js";

export const KPI_WEEKS = 12;

interface Shape {
  readonly id: KpiSeries["id"];
  readonly manual: number;
  readonly target: number;
  /** The first week's value and the last week's. */
  readonly from: number;
  readonly to: number;
  readonly noise: number;
  readonly decimals: number;
}

function series(
  random: SeededRandom,
  reference: string,
  shape: Shape,
): KpiSeries {
  const lastMonday = mondayOf(reference);
  const factor = 10 ** shape.decimals;
  const weekly: WeeklyValue[] = [];
  for (let k = 0; k < KPI_WEEKS; k++) {
    const progress = k / (KPI_WEEKS - 1);
    const wobble = (random.next() * 2 - 1) * shape.noise;
    const raw = shape.from + (shape.to - shape.from) * progress + wobble;
    // The last week is the figure the data itself gives, with no wobble.
    const value = k === KPI_WEEKS - 1 ? shape.to : Math.max(0, raw);
    weekly.push({
      weekStart: addDays(lastMonday, -7 * (KPI_WEEKS - 1 - k)),
      value: Math.round(value * factor) / factor,
    });
  }
  return { id: shape.id, manual: shape.manual, target: shape.target, weekly };
}

function hoursBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 3_600_000;
}

/**
 * Five measures, twelve weeks each, with targets. The series are fixture
 * values that trend towards where the data stands today: overdue orders end
 * on the number of orders with late work, and the approval turnaround ends on
 * the average hours between a request and its decision. The formulas that
 * will compute them from events are area 3's.
 */
export function makeKpis(
  random: SeededRandom,
  reference: string,
  orders: readonly SampleOrder[],
  sprs: readonly SampleSpr[],
): KpiSeries[] {
  const overdue = orders.filter(
    (o) => o.step.dueOn !== null && o.step.dueOn < reference,
  ).length;
  const decided = sprs.flatMap((s) =>
    s.decision ? [hoursBetween(s.requestedAt, s.decision.at)] : [],
  );
  const turnaround =
    decided.length === 0
      ? 12
      : decided.reduce((sum, h) => sum + h, 0) / decided.length;
  return [
    series(random, reference, {
      id: "processingTime",
      manual: 42,
      target: 15,
      from: 37,
      to: 17.4,
      noise: 2,
      decimals: 1,
    }),
    series(random, reference, {
      id: "manualTouches",
      manual: 18,
      target: 6,
      from: 16,
      to: 7,
      noise: 1,
      decimals: 1,
    }),
    series(random, reference, {
      id: "dataEntryErrors",
      manual: 5,
      target: 1,
      from: 4.4,
      to: 1.4,
      noise: 0.4,
      decimals: 1,
    }),
    series(random, reference, {
      id: "approvalTurnaround",
      manual: 20,
      target: 6,
      from: 24,
      to: turnaround,
      noise: 2,
      decimals: 1,
    }),
    series(random, reference, {
      id: "overdueOrders",
      manual: Math.ceil(overdue * 1.8),
      target: Math.floor(overdue / 2),
      from: Math.ceil(overdue * 1.6),
      to: overdue,
      noise: Math.max(1, overdue / 8),
      decimals: 0,
    }),
  ];
}
