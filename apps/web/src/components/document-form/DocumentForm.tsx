import type { ReactNode } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DemoBadge, PageHeader, type DemoBadgeKind } from "@/components/common";
import { toast } from "@/components/common/toast";
import {
  FormShell,
  useDraft,
  type DraftOptions,
  type PathMap,
} from "@/components/form";
import { DocumentActionBar } from "./DocumentActionBar";
import { DocumentFooter } from "./DocumentFooter";
import { DocumentTabs } from "./DocumentTabs";
import { printForm } from "./printForm";
import type {
  AttachmentItem,
  DocumentAction,
  DocumentPrint,
  DocumentStatus,
  DocumentTabsSpec,
  FooterFigure,
} from "./types";
import { useDocumentSave } from "./useDocumentSave";

const NONE: readonly never[] = [];

const WHEN = new Intl.DateTimeFormat("en-SG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Singapore",
});

export interface DocumentFormProps<T extends FieldValues, O, R> {
  /** Names this form for the shared actions and for the draft's owner. */
  formId: string;
  form: UseFormReturn<T, unknown, O>;
  /** Names the record, such as "Sales order SO-10001". */
  title: string;
  /** The document's number: the log's title and the shared actions use it. */
  number: string;
  description?: string;
  demo?: DemoBadgeKind;
  headingLevel?: 1 | 2;
  /** Names the form for screen readers. */
  formLabel: string;
  /** The header fields: a `FormGrid` of kit fields. */
  header: ReactNode;
  /** The lines grid, between the header and the footer. */
  lines?: ReactNode;
  status: DocumentStatus;
  attachments?: readonly AttachmentItem[];
  totals?: readonly FooterFigure[];
  /** Every action the document has. The template draws those the role may use. */
  actions: readonly DocumentAction[];
  /** Unsaved changes are kept under this key, for this viewer. */
  draftKey: string;
  draftOptions?: DraftOptions;
  onSave: (values: O, andNew: boolean) => Promise<R>;
  onSaved?: (result: R, andNew: boolean) => void | Promise<void>;
  /** The server's field paths where the form calls them something else. */
  serverPaths?: PathMap;
  /** Why saving is not allowed now, already translated. */
  saveBlocked?: string;
  /** Lets an unchanged form save, for a document filled in by its defaults. */
  allowClean?: boolean;
  /** What Print or PDF shows; called when pressed. Without it Print is not drawn. */
  print?: () => DocumentPrint;
  tabs: DocumentTabsSpec;
}

/**
 * The form every order, SPR, payment confirmation and shipment uses. A screen
 * declares its header fields, its lines, its status, its actions and its
 * tabs; the template draws the page: title, action bar, header, lines, footer
 * with attachments, status and totals, and the tabs below. It keeps unsaved
 * changes through an expired session (the draft), shows the server's words on
 * each field, and checks each action's permission. Void and Reject ask why.
 */
export function DocumentForm<T extends FieldValues, O, R = unknown>(
  props: DocumentFormProps<T, O, R>,
) {
  const { form, formId, title, number, formLabel, tabs } = props;
  const { t } = useTranslation("document-form");
  const { t: tc } = useTranslation("components");
  const draft = useDraft(props.draftKey, form, props.draftOptions);
  const allowClean = props.allowClean ?? false;
  const { save, saveNew } = useDocumentSave(form, {
    onSave: props.onSave,
    draft,
    blockedReason: props.saveBlocked,
    allowClean,
    serverPaths: props.serverPaths,
    ...(props.onSaved ? { onSaved: props.onSaved } : {}),
  });
  const { print } = props;
  const onPrint = print
    ? () => {
        printForm(print(), {
          demo: tc("badges.synthetic"),
          printedOn: t("print.printedOn", { when: WHEN.format(new Date()) }),
        }).catch(() => {
          toast.failed(t("print.failed"));
        });
      }
    : undefined;

  return (
    <div className="space-y-s2">
      <PageHeader
        title={title}
        {...(props.description ? { description: props.description } : {})}
        headingLevel={props.headingLevel ?? 1}
        meta={props.demo ? <DemoBadge kind={props.demo} /> : null}
      />
      <FormShell form={form} draft={draft} aria-label={formLabel}>
        <DocumentActionBar
          form={form}
          actions={props.actions}
          save={save}
          saveNew={saveNew}
          onPrint={onPrint}
          target={{ formId, label: number }}
          saveBlocked={props.saveBlocked}
          allowClean={allowClean}
        />
        <section aria-label={t("sections.header")}>{props.header}</section>
        {props.lines ? (
          <section aria-label={t("sections.lines")}>{props.lines}</section>
        ) : null}
        <DocumentFooter
          status={props.status}
          attachments={props.attachments ?? NONE}
          totals={props.totals ?? NONE}
        />
      </FormShell>
      <DocumentTabs spec={tabs} label={number} />
    </div>
  );
}
