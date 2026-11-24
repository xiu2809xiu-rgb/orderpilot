import type { Session } from "@orderpilot/shared";
import {
  Activity,
  Keyboard,
  Palette,
  Shield,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { hasPermission } from "@/stores/session";
import { visibleControlRows } from "./controlRows";

export const SECTION_IDS = [
  "account",
  "appearance",
  "shortcuts",
  "privacy",
  "ai",
  "controls",
  "health",
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export interface SectionDef {
  id: SectionId;
  /** "you" is about the person; "app" is about OrderPilot itself. */
  group: "you" | "app";
  icon: LucideIcon;
  visible: (session: Session | null) => boolean;
}

const everyone = (session: Session | null) => session !== null;

export const ACCOUNT_SECTION: SectionDef = {
  id: "account",
  group: "you",
  icon: UserRound,
  visible: everyone,
};

/** The sections, in the order the list shows them. */
export const SECTIONS: readonly SectionDef[] = [
  ACCOUNT_SECTION,
  { id: "appearance", group: "you", icon: Palette, visible: everyone },
  { id: "shortcuts", group: "you", icon: Keyboard, visible: everyone },
  { id: "privacy", group: "you", icon: Shield, visible: everyone },
  { id: "ai", group: "app", icon: Sparkles, visible: everyone },
  {
    id: "controls",
    group: "app",
    icon: SlidersHorizontal,
    visible: (session) => visibleControlRows(session).length > 0,
  },
  {
    id: "health",
    group: "app",
    icon: Activity,
    visible: (session) => hasPermission(session, "settings.manage"),
  },
];

export function visibleSections(session: Session | null): SectionDef[] {
  return SECTIONS.filter((section) => section.visible(session));
}
