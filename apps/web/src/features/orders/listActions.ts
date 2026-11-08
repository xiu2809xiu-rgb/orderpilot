import type { ListAction } from "@/components/list-page";

/**
 * What the Orders list offers: Export and Print, for anyone who may read
 * orders. There is no New yet, because entering an order arrives with its own
 * story, and no action that orders stock, because a person decides that.
 */
export function readOnlyActions<Row>(): ListAction<Row>[] {
  return [
    { id: "export", kind: "export", permission: "orders.read" },
    { id: "print", kind: "print", permission: "orders.read" },
  ];
}
