import { useMemo } from "react";
import { useSearchParams } from "react-router";
import type { TableQuery } from "@/components/common";
import type { AuditViewerListParams } from "@/lib/api/generated/model";

/**
 * The audit list keeps its filters in the address bar, so a link from a record
 * (`/audit?entity=Order&id=...`, the common AuditLink) opens the right view and
 * a view can be shared. These are the short names used in the URL.
 */
export const FILTER_IDS = [
  "entity",
  "id",
  "actor",
  "kind",
  "role",
  "action",
  "from",
  "to",
] as const;
export type FilterId = (typeof FILTER_IDS)[number] | "refusals";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export type FilterProblem = "actor" | "range" | "date" | null;

export interface ListRequest {
  params: AuditViewerListParams;
  /** Set when a filter cannot be sent: the list is not fetched and the page says why. */
  problem: FilterProblem;
}

function startOf(day: string): string | null {
  const date = DAY.test(day) ? new Date(`${day}T00:00:00`) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

function endOf(day: string): string | null {
  const date = DAY.test(day) ? new Date(`${day}T23:59:59.999`) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

/** Turns what the table holds into the API's query, or says why it cannot. */
export function toListRequest(query: TableQuery): ListRequest {
  const text = (id: FilterId): string | undefined => {
    const value = query.filters[id];
    return typeof value === "string" && value.trim() !== ""
      ? value.trim()
      : undefined;
  };
  const params: AuditViewerListParams = {
    page: query.page,
    pageSize: query.pageSize,
  };
  let problem: FilterProblem = null;

  const entity = text("entity");
  const id = text("id");
  const actor = text("actor");
  const kind = text("kind");
  const role = text("role");
  const action = text("action");
  const from = text("from");
  const to = text("to");
  if (entity) params.entityType = entity;
  if (id) params.entityId = id;
  if (kind) params.actorKind = kind as AuditViewerListParams["actorKind"];
  if (role) params.role = role as AuditViewerListParams["role"];
  if (action) params.action = action;
  if (query.filters.refusals === true) params.refusalsOnly = "true";
  if (query.search.trim() !== "") params.search = query.search.trim();

  if (actor) {
    if (UUID.test(actor)) params.actorUserId = actor;
    else problem = "actor";
  }
  const start = from ? startOf(from) : null;
  const end = to ? endOf(to) : null;
  if ((from && !start) || (to && !end)) problem ??= "date";
  if (start) params.from = start;
  if (end) params.to = end;
  if (start && end && start > end) problem ??= "range";
  return { params, problem };
}

function number(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= max
    ? parsed
    : fallback;
}

/** The table's query, read from and written to the address bar. */
export function useAuditQuery() {
  const [params, setParams] = useSearchParams();
  const query = useMemo<TableQuery>(() => {
    const filters: TableQuery["filters"] = {};
    for (const id of FILTER_IDS) {
      const value = params.get(id);
      if (value) filters[id] = value;
    }
    if (params.get("refusals") === "1") filters.refusals = true;
    return {
      page: number(params.get("page"), 1, 1_000_000),
      pageSize: number(params.get("pageSize"), 25, 200),
      sort: null,
      search: params.get("q") ?? "",
      filters,
    };
  }, [params]);

  const setQuery = (next: TableQuery) => {
    const out = new URLSearchParams();
    for (const id of FILTER_IDS) {
      const value = next.filters[id];
      if (typeof value === "string" && value !== "") out.set(id, value);
    }
    if (next.filters.refusals === true) out.set("refusals", "1");
    if (next.search !== "") out.set("q", next.search);
    if (next.page !== 1) out.set("page", String(next.page));
    if (next.pageSize !== 25) out.set("pageSize", String(next.pageSize));
    const event = params.get("event");
    if (event) out.set("event", event);
    setParams(out, { replace: true });
  };

  const openEvent = (id: string | null) => {
    const out = new URLSearchParams(params);
    if (id) out.set("event", id);
    else out.delete("event");
    setParams(out, { replace: true });
  };

  return { query, setQuery, openEvent, eventId: params.get("event") };
}
