import type { ListAction } from "@/components/list-page";

/**
 * What the Orders list offers beside New order: Export and Print, for anyone
 * who may read orders. There is no action that orders stock, because a person
 * decides that.
 */
export function readOnlyActions<Row>(): ListAction<Row>[] {
  return [
    { id: "export", kind: "export", permission: "orders.read" },
    { id: "print", kind: "print", permission: "orders.read" },
  ];
}
