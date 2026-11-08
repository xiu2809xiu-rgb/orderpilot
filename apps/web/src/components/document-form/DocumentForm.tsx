import type { ReactNode } from "react";
import type {
  DefaultValues,
  FieldValues,
  UseFormReturn,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DemoBadge, PageHeader, type DemoBadgeKind } from "@/components/common";
import {
  FormShell,
  useDraft,
  type DraftOptions,
  type PathMap,
} from "@/components/form";
import { useSessionStore } from "@/stores/session";
import { usableActions } from "./actions";
import { DocumentActionBar } from "./DocumentActionBar";
import { DocumentFooter } from "./DocumentFooter";
import { DocumentRecordStatePanel } from "./DocumentRecordStatePanel";
import { DocumentTabs } from "./DocumentTabs";
import { usePrintAction } from "./usePrintAction";
import type {
  AttachmentItem,
  DocumentAction,
  DocumentPrint,
  DocumentRecordState,
  DocumentStatus,
  DocumentTabsSpec,
  FooterFigure,
} from "./types";
import { useDocumentSave } from "./useDocumentSave";

const NONE: readonly never[] = [];

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
  /**
   * Between the action bar and the header: what the whole document needs to
   * say first, such as the approval route (P-61) or a payment hold (P-62).
   */
  notices?: ReactNode;
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
  /**
   * The next document's blank values. After Save and new the form is reset to
   * them and the draft is cleared, then `onSaved` runs.
   */
  nextValues?: () => NoInfer<DefaultValues<T>>;
  /** Lets an unchanged form save, for a document filled in by its defaults. */
  allowClean?: boolean;
  /** What Print or PDF shows; called when pressed. Without it Print is not drawn. */
  print?: () => DocumentPrint;
  tabs: DocumentTabsSpec;
  /**
   * While the record is loading, failed, forbidden or missing: the template
   * draws that under the title instead of the form.
   */
  state?: DocumentRecordState;
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
  if (!props.state) return <LoadedDocument {...props} />;
  return (
    <div className="space-y-s2">
      <PageHeader
        title={props.title}
        headingLevel={props.headingLevel ?? 1}
        meta={props.demo ? <DemoBadge kind={props.demo} /> : null}
      />
      <DocumentRecordStatePanel state={props.state} />
    </div>
  );
}

// A component of its own so the draft, the shortcut and the viewer are
// read only once the record is in hand.
function LoadedDocument<T extends FieldValues, O, R>(
  props: DocumentFormProps<T, O, R>,
) {
  const { form, formId, title, number, formLabel, tabs } = props;
  const { t } = useTranslation("document-form");
  const draft = useDraft(props.draftKey, form, props.draftOptions);
  const session = useSessionStore((state) => state.session);
  const allowClean = props.allowClean ?? false;
  // Ctrl+S has no button to be blocked with, so it follows the same rule as the
  // bar: no usable Save action, no saving from the keyboard.
  const canSave = usableActions(props.actions, session).some(
    (action) => action.kind === "save",
  );
  const shortcutBlocked =
    props.saveBlocked ?? (canSave ? undefined : t("bar.noSave"));
  const { save, saveNew } = useDocumentSave(form, {
    onSave: props.onSave,
    draft,
    blockedReason: shortcutBlocked,
    allowClean,
    nextValues: props.nextValues,
    serverPaths: props.serverPaths,
    ...(props.onSaved ? { onSaved: props.onSaved } : {}),
  });
  const onPrint = usePrintAction(props.print, props.status.label);

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
        {props.notices}
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
