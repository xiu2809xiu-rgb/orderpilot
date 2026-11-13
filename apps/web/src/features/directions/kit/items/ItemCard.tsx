import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type Vendor = "magic" | "bits" | "reui";

interface ItemCardProps {
  /** The key of the item's name under `items` in the locale file. */
  item: string;
  vendor: Vendor;
  children: ReactNode;
  className?: string;
  /** Where the demo sits in its box. */
  align?: "center" | "start";
  /** Let a wide demo scroll sideways inside its box instead of being clipped. */
  scroll?: boolean;
}

/**
 * One kit item shown live: its name, the demo, and a line with its vendor and
 * licence. The demo box is `relative` so items that draw a border or a ground
 * can fill it.
 */
export function ItemCard({
  item,
  vendor,
  children,
  className,
  align = "center",
  scroll = false,
}: ItemCardProps) {
  const { t } = useTranslation("directions-kit-items");
  const licence = vendor === "magic" || vendor === "reui" ? "mit" : "commons";
  return (
    <figure className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div
        className={cn(
          "relative flex min-h-28 min-w-0 flex-col justify-center gap-2 border border-border bg-background p-4",
          scroll ? "overflow-x-auto" : "overflow-hidden",
          align === "center" ? "items-center text-center" : "items-start",
        )}
        style={{ borderRadius: "var(--radius-card)" }}
      >
        {children}
      </div>
      <figcaption className="flex flex-col">
        <span className="fs-14 font-medium text-foreground">
          {t(`items.${item}`)}
        </span>
        <span className="fs-13 text-muted-foreground">
          {t("vendorLine", {
            vendor: t(`vendors.${vendor}.title`),
            licence: t(`licence.${licence}`),
          })}
        </span>
      </figcaption>
    </figure>
  );
}
