import type { OperationLogEntity, Permission } from "@orderpilot/shared";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { StatusFamily } from "@/components/common";

/**
 * The kinds of action, in the order the bar draws them. Save and Save and new
 * are the template's own work (they go through the form kit's save); Print
 * uses the browser's print view; the others call the screen.
 */
export const DOCUMENT_ACTION_KINDS = [
  "save",
  "saveNew",
  "submit",
  "approve",
  "reject",
  "print",
  "void",
] as const;
export type DocumentActionKind = (typeof DOCUMENT_ACTION_KINDS)[number];

/** The words and the work of a Void or Reject, which always asks for a reason. */
export interface DocumentReasoned {
  title: string;
  description?: string;
  confirmLabel: string;
  /** The toast that ends the action, such as "SO-10001 voided". */
  doneMessage: string;
  /** Sends the reason. A throw lands on the reason field. */
  run: (reason: string) => Promise<unknown>;
}

interface DocumentActionBase {
  id: string;
  /** Already translated. Each kind has a default. */
  label?: string;
  icon?: LucideIcon;
  /** The role must hold it, or the button is not drawn at all. */
  permission: Permission;
  /**
   * Why this document cannot take the action now, already translated, such as
   * "Only a document waiting for approval can be approved." The button then
   * stays reachable and gives the reason.
   */
  blocked?: string | undefined;
}

/**
 * One action of a document, by kind, so the type says what each kind needs:
 * Save, Save and new and Print are the template's own work; Submit and
 * Approve call the screen (`run`); Void and Reject ask for a reason first
 * (`reasoned`). A kind declared without its handler does not compile, and
 * declaring two of one kind warns in development.
 */
export type DocumentAction = DocumentActionBase &
  (
    | { kind: "save" | "saveNew" | "print"; run?: never; reasoned?: never }
    | {
        kind: "submit" | "approve";
        /** While the form has unsaved changes the button waits, with "Save your changes first". */
        run: () => unknown;
        reasoned?: never;
      }
    | { kind: "void" | "reject"; reasoned: DocumentReasoned; run?: never }
  );

/** One attachment on the document, such as the customer's PO as received. */
export interface AttachmentItem {
  id: string;
  name: string;
  /** Already formatted, such as "182 KB". */
  size?: string;
  href?: string;
}

/** A figure in the footer, such as the grand total. The value is already drawn. */
export interface FooterFigure {
  id: string;
  label: string;
  value: ReactNode;
}

export interface DocumentStatus {
  family?: StatusFamily | undefined;
  /** Already translated: "Waiting for approval". */
  label: string;
}

/** What the browser's print view shows. A function, so it reads the form as it is then. */
export interface DocumentPrint {
  title: string;
  fields: readonly { label: string; value: string }[];
  lines?: { columns: readonly string[]; rows: readonly (readonly string[])[] };
  totals?: readonly { label: string; value: string }[];
}

/** One tab under the form. */
export interface DocumentTabSpec {
  /** How many items need attention, such as failed checks. Zero draws no badge. */
  count?: number;
  /** Null draws the compact empty state. */
  content: ReactNode | null;
  /** Replaces the default empty line. */
  emptyText?: string;
}

export interface DocumentTabsSpec {
  timeline: DocumentTabSpec;
  checks: DocumentTabSpec;
  documents: DocumentTabSpec;
  /** The record's operation log, read from the record-scoped route. */
  log?: { entityType: OperationLogEntity; entityId: string };
}

/** What a registered action is told about the document it was opened on. */
export interface DocumentTarget {
  /** The form's `formId`, such as "gallery-document". */
  formId: string;
  /** The document's number, such as "SO-10001". */
  label: string;
}

/**
 * What a screen passes while its record is not in hand. The template draws the
 * state under the title and mounts the form only once none is passed, so a
 * draft is never restored over values that have not loaded.
 */
export type DocumentRecordState =
  | { kind: "loading" }
  | {
      kind: "error";
      /** Any thrown value: the words and the trace id come from it. */
      error: unknown;
      onRetry?: () => void;
    }
  | { kind: "denied"; description?: string }
  | { kind: "notFound"; description?: string };
