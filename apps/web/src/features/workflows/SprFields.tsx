import type { SprField } from "@orderpilot/shared";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * The SPR's fields with where each value came from. A suggested value carries
 * the Suggested mark and a tinted row: it is the system's proposal until a
 * person approves it.
 */
export function SprFields({ fields }: { fields: readonly SprField[] }) {
  const { t } = useTranslation("workflows");
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("spr.field")}</TableHead>
          <TableHead>{t("spr.value")}</TableHead>
          <TableHead>{t("spr.source")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {fields.map((field) => (
          <TableRow
            key={field.key}
            data-origin={field.origin}
            className={cn(field.origin === "suggested" && "bg-accent/40")}
          >
            <TableCell className="font-medium">
              {field.label}
              {field.required ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {t("spr.required")}
                </span>
              ) : null}
            </TableCell>
            <TableCell data-numeric>
              {field.value === "" ? (
                <span className="text-muted-foreground">
                  {t("spr.emptyValue")}
                </span>
              ) : (
                field.value
              )}
            </TableCell>
            <TableCell>
              <Badge
                variant={field.origin === "suggested" ? "default" : "outline"}
              >
                {field.origin === "suggested" ? (
                  <Sparkles aria-hidden="true" />
                ) : null}
                {t(`spr.origin.${field.origin}`)}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
