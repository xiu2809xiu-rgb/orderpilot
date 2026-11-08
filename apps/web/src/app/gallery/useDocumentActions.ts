import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/common";
import type { DocumentAction } from "@/components/document-form";
import type { DocStatus } from "./documentDemo";
import type { DocumentInput, DocumentOutput } from "./documentDemo";

/**
 * The gallery document's actions. Every one is declared; the template draws
 * those the role may use. No write permission exists in packages/shared yet, and
 * the matrix is area 4's, so the gallery borrows the ones that exist
 * (reading orders for the document's own work, and the approver's
 * permission to decide).
 */
export function useDocumentActions(
  form: UseFormReturn<DocumentInput, unknown, DocumentOutput>,
  status: DocStatus,
  number: string,
  setStatus: (status: DocStatus) => void,
): DocumentAction[] {
  const { t } = useTranslation("gallery");
  const only = (ok: boolean, key: string) =>
    ok ? undefined : t(`document.blocked.${key}`);
  const done = (next: DocStatus, key: string) => () => {
    setStatus(next);
    toast.done(t(`document.${key}`, { number }));
  };
  const reasoned = (next: DocStatus, key: string) => ({
    title: t(`document.${key}Title`),
    description: t(`document.${key}Description`),
    confirmLabel: t(`document.${key}Confirm`),
    doneMessage: t(`document.${key}Done`, { number }),
    run: () => {
      setStatus(next);
      return Promise.resolve();
    },
  });
  return [
    { id: "save", kind: "save", permission: "orders.read" },
    { id: "saveNew", kind: "saveNew", permission: "orders.read" },
    {
      id: "submit",
      kind: "submit",
      permission: "orders.read",
      blocked: only(status === "draft", "submit"),
      run: done("waiting", "submitted"),
    },
    {
      id: "approve",
      kind: "approve",
      permission: "approvals.decide",
      blocked: only(status === "waiting", "approve"),
      run: done("approved", "approved"),
    },
    {
      id: "reject",
      kind: "reject",
      permission: "approvals.decide",
      blocked: only(status === "waiting", "approve"),
      reasoned: reasoned("draft", "reject"),
    },
    { id: "print", kind: "print", permission: "orders.read" },
    {
      id: "void",
      kind: "void",
      permission: "orders.read",
      blocked: only(status !== "void", "void"),
      reasoned: reasoned("void", "void"),
    },
  ];
}
