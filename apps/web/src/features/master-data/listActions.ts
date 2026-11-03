import type { ListAction } from "@/components/list-page";

/**
 * What every master data list offers: Export and Print, for anyone who may read
 * these records. There is no New, Edit or Void, because Navision stays the
 * system of record.
 */
export function readOnlyActions<Row>(): ListAction<Row>[] {
  return [
    { id: "export", kind: "export", permission: "orders.read" },
    { id: "print", kind: "print", permission: "orders.read" },
  ];
}
