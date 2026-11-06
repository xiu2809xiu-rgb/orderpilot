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

export interface DocumentAction {
  id: string;
  kind: DocumentActionKind;
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
  /** For Submit and Approve; the template asks Save first if the form has changes. */
  run?: () => unknown;
  /** For Void and Reject: the template asks for a reason, then runs this. */
  reasoned?: DocumentReasoned;
}

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
