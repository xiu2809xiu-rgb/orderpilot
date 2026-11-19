import type { Role } from "@orderpilot/shared";
import type { TFunction } from "i18next";

/** Where a step's light falls. */
export type TourTarget =
  | { kind: "none" }
  | { kind: "selector"; selector: string }
  /** The section under a heading, found by the heading's words on screen. */
  | { kind: "heading"; text: (t: TFunction) => string };

/** What a click on the target did, so the last step can put it back. */
export type TourUndoKind = "task" | "spr" | "payment";

export interface TourStep {
  /** Its words are `tour.steps.<id>.title` and `.body` in common.json. */
  id: string;
  /** The tour signs in as this role when the step starts. */
  role: Role;
  /** The tour goes here when the step starts; a step after a click stays where the click led. */
  path?: string;
  target: TourTarget;
  /** "click": the person clicks the lit button; "next": they press Next. */
  advance: "click" | "next";
  /** For a "next" step: whether Next may be pressed yet. */
  ready?: (target: Element) => boolean;
  undo?: TourUndoKind;
}

/** Home's task button for the first task of a kind (`NeedRow`). */
const taskButton = (kind: string): TourTarget => ({
  kind: "selector",
  selector: `[data-task-action][data-task-kind="${kind}"]`,
});

const approveButton: TourTarget = {
  kind: "selector",
  selector: 'form:has(#spr-comment) button[type="submit"]',
};

/**
 * The sales flow, step by step, across the six teams, as the demo shows it:
 * the order's steps, then each team's own task on its Home, then the
 * reminders. Each team's task is on a different sample order, because the
 * sample orders each wait at a different step.
 */
export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "welcome",
    role: "APPROVER",
    path: "/",
    target: { kind: "none" },
    advance: "next",
  },
  {
    id: "flows",
    role: "APPROVER",
    path: "/",
    target: {
      kind: "heading",
      text: (t) => t("flows.title", { ns: "directions-home" }),
    },
    advance: "next",
  },
  {
    id: "review",
    role: "SUPPORT",
    path: "/",
    target: taskButton("REVIEW_FIELDS"),
    advance: "click",
  },
  {
    id: "journey",
    role: "SUPPORT",
    target: {
      kind: "heading",
      text: (t) => t("order.journey.title", { ns: "directions-orders" }),
    },
    advance: "next",
  },
  {
    id: "raise",
    role: "PRODUCT_MANAGER",
    path: "/",
    target: taskButton("RAISE_SPR"),
    advance: "click",
    undo: "task",
  },
  {
    id: "openSpr",
    role: "APPROVER",
    path: "/",
    target: taskButton("APPROVE_SPR"),
    advance: "click",
  },
  { id: "refused", role: "APPROVER", target: approveButton, advance: "click" },
  {
    id: "comment",
    role: "APPROVER",
    target: { kind: "selector", selector: "#spr-comment" },
    advance: "next",
    ready: (target) =>
      target instanceof HTMLTextAreaElement && target.value.trim() !== "",
  },
  {
    id: "approve",
    role: "APPROVER",
    target: approveButton,
    advance: "click",
    undo: "spr",
  },
  {
    id: "history",
    role: "APPROVER",
    target: {
      kind: "heading",
      text: (t) => t("spr.historyHeading", { ns: "workflows" }),
    },
    advance: "next",
  },
  {
    id: "sendPi",
    role: "SUPPORT",
    path: "/",
    target: taskButton("SEND_PI"),
    advance: "click",
    undo: "task",
  },
  {
    id: "payment",
    role: "FINANCE",
    path: "/",
    target: taskButton("CONFIRM_PAYMENT"),
    advance: "click",
    undo: "payment",
  },
  {
    id: "pack",
    role: "WAREHOUSE",
    path: "/",
    target: taskButton("PACK_ORDER"),
    advance: "click",
    undo: "task",
  },
  {
    id: "ship",
    role: "LOGISTICS",
    path: "/",
    target: taskButton("ADD_SHIPPING_DOCUMENTS"),
    advance: "click",
    undo: "task",
  },
  {
    id: "reminders",
    role: "APPROVER",
    path: "/workflows/reminders",
    target: {
      kind: "heading",
      text: (t) =>
        t("reminders.forRole", {
          ns: "workflows",
          role: t("roles.APPROVER", { ns: "common" }),
        }),
    },
    advance: "next",
  },
  {
    id: "finish",
    role: "APPROVER",
    path: "/",
    target: { kind: "none" },
    advance: "next",
  },
];
