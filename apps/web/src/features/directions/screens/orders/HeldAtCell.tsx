import { useTranslation } from "react-i18next";
import { heldAtOf, heldAtWords } from "./heldAt";
import type { OrderRow } from "./orderRow";

/** The list's "Held at": the team in text, and every other answer muted. */
export function HeldAtCell({
  row,
  roleLabel,
}: {
  row: OrderRow;
  roleLabel: (role: NonNullable<OrderRow["ownerRole"]>) => string;
}) {
  const { t } = useTranslation("directions-orders");
  const held = heldAtOf(row);
  const words = heldAtWords(held, t, roleLabel);
  // A long role name takes two lines rather than widen the column.
  return held.kind === "team" ? (
    <span className="od-held">{words}</span>
  ) : (
    <span className="text-muted-foreground">{words}</span>
  );
}
