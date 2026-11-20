import type { Role } from "@orderpilot/shared";
import {
  Banknote,
  BadgeCheck,
  ChartNoAxesCombined,
  Headset,
  Package,
  ScrollText,
  Settings2,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export const ROLE_ICONS: Record<Role, LucideIcon> = {
  SYSTEM_ADMIN: Settings2,
  PRODUCT_MANAGER: Package,
  APPROVER: BadgeCheck,
  SUPPORT: Headset,
  WAREHOUSE: Warehouse,
  FINANCE: Banknote,
  LOGISTICS: Truck,
  MANAGEMENT: ChartNoAxesCombined,
  AUDITOR: ScrollText,
};
