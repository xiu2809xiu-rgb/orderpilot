import {
  Building2,
  Factory,
  FileText,
  ListChecks,
  Package,
  ShoppingCart,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { RecordKind } from "@/lib/records";

/** The icon a tab shows for each kind of record, matched to the menu where one exists. */
export const RECORD_KIND_ICONS: Record<RecordKind, LucideIcon> = {
  order: Truck,
  orderSteps: ListChecks,
  spr: ShoppingCart,
  document: FileText,
  item: Package,
  customer: Building2,
  vendor: Factory,
};
