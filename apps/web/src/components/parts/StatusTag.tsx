import {
  CircleCheck,
  Clock,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusChip, type StatusKind } from "../kit/StatusChip";

/** The four ideas of status, the same in every direction: on time, waiting, a mismatch, information. */
export type Tone = "ok" | "waiting" | "mismatch" | "info";

const KIND: Record<Tone, StatusKind> = {
  ok: "success",
  waiting: "warning",
  mismatch: "destructive",
  info: "info",
};
const ICON: Record<Tone, LucideIcon> = {
  ok: CircleCheck,
  waiting: Clock,
  mismatch: TriangleAlert,
  info: Info,
};

/**
 * A status as a chip: a word and an icon, whatever the colour. The word is the
 * tone's own unless the caller has a more exact one ("Packing list differs").
 * The chip is a pill.
 */
export function StatusTag({ tone, label }: { tone: Tone; label?: string }) {
  const { t } = useTranslation("directions-parts");
  return (
    <StatusChip kind={KIND[tone]} icon={ICON[tone]}>
      {label ?? t(`tone.${tone}`)}
    </StatusChip>
  );
}
