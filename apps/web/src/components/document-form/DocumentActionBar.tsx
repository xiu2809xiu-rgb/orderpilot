import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useFormState } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useSaveReason, useViewerChanged } from "@/components/form";
import { useSessionStore } from "@/stores/session";
import {
  KIND_ICONS,
  NEEDS_SAVED,
  usableActions,
  warnDuplicateKinds,
} from "./actions";
import { BarButton } from "./BarButton";
import { ExtraActions } from "./ExtraActions";
import type {
  DocumentAction,
  DocumentActionKind,
  DocumentTarget,
} from "./types";
import { useActionRunner } from "./useActionRunner";

interface DocumentActionBarProps<T extends FieldValues, O> {
  form: UseFormReturn<T, unknown, O>;
  actions: readonly DocumentAction[];
  save: () => Promise<void>;
  saveNew: () => Promise<void>;
  /** Present only when the form has something to print. */
  onPrint: (() => void) | undefined;
  target: DocumentTarget;
  saveBlocked: string | undefined;
  allowClean: boolean;
}

/** The one primary button is the first of these that can run now. */
const PRIMARY_ORDER: readonly DocumentActionKind[] = [
  "save",
  "approve",
  "submit",
];

/**
 * The bar: Save, Save and new, Submit for approval, Approve or Reject, Print
 * or PDF and Void, each drawn only if the form declares it and the role holds
 * its permission. An action on what is saved waits, with its reason, while the
 * form has unsaved changes.
 */
export function DocumentActionBar<T extends FieldValues, O>({
  form,
  actions,
  save,
  saveNew,
  onPrint,
  target,
  saveBlocked,
  allowClean,
}: DocumentActionBarProps<T, O>) {
  const { t } = useTranslation("document-form");
  const session = useSessionStore((state) => state.session);
  const { isDirty } = useFormState({ control: form.control });
  const saveState = useSaveReason(form, {
    ...(saveBlocked ? { blockedReason: saveBlocked } : {}),
    allowClean,
  });
  const { run, dialog, busy } = useActionRunner();
  const otherViewer = useViewerChanged();
  if (import.meta.env.DEV) warnDuplicateKinds(target.formId, actions);
  const usable = usableActions(actions, session).filter(
    (action) => action.kind !== "print" || onPrint !== undefined,
  );

  function blockedOf(action: DocumentAction): string | undefined {
    // Before anything else: the values and the record on screen belong to the
    // first person, so nothing, Print included, acts on them for the next.
    if (otherViewer) return t("bar.otherViewer");
    if (action.kind === "save" || action.kind === "saveNew") {
      if (busy) return t("bar.working");
      if (saveState.isSubmitting) return t("bar.saving");
      return saveState.reason;
    }
    if (action.kind === "print") return busy ? t("bar.working") : undefined;
    if (action.blocked) return action.blocked;
    if (busy) return t("bar.working");
    if (NEEDS_SAVED.includes(action.kind) && isDirty) return t("bar.saveFirst");
    return undefined;
  }

  // What the person can do next is emphasised; a blocked Save is not.
  const primary =
    PRIMARY_ORDER.find((kind) =>
      usable.some((action) => action.kind === kind && !blockedOf(action)),
    ) ??
    PRIMARY_ORDER.find((kind) => usable.some((action) => action.kind === kind));

  function runOf(action: DocumentAction): void {
    if (action.kind === "save") void save();
    else if (action.kind === "saveNew") void saveNew();
    else if (action.kind === "print") onPrint?.();
    else run(action);
  }

  return (
    <div
      role="group"
      aria-label={t("bar.label")}
      className="flex flex-wrap items-center gap-2"
    >
      {usable.map((action) => (
        <BarButton
          key={action.id}
          label={action.label ?? t(`bar.${action.kind}`)}
          icon={action.icon ?? KIND_ICONS[action.kind]}
          primary={action.kind === primary}
          blocked={blockedOf(action)}
          {...(action.kind === "save" ? { shortcut: "Control+S" } : {})}
          onRun={() => {
            runOf(action);
          }}
        />
      ))}
      <ExtraActions target={target} />
      {dialog}
    </div>
  );
}
