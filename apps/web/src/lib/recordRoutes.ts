import type { RouteObject } from "react-router";

let table: RouteObject[] = [];

/** The router hands over its routes once, so a link can find its record without opening it. */
export function setRecordRoutes(routes: RouteObject[]): void {
  table = routes;
}

export function recordRoutes(): RouteObject[] {
  return table;
}
