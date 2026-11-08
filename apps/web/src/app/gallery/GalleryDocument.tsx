import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/common";
import { DocumentForm } from "@/components/document-form";
import { useZodForm } from "@/components/form";
import { LinesGrid, type LineColumn } from "@/components/lines-grid";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GalleryDocumentFields } from "./GalleryDocumentFields";
import { useDocumentActions } from "./useDocumentActions";
import {
  DOC_FAMILY,
  blankDocument,
  DOC_STATUSES,
  documentNumber,
  fakeDocumentSave,
  makeDocumentSchema,
  type DocStatus,
  type DocumentInput,
  type DocumentOutput,
} from "./documentDemo";
import { searchGalleryItems, startingLines } from "./linesDemo";
import { galleryDocumentTabs } from "./GalleryDocumentTabs";
import { GALLERY_CUSTOMERS } from "./orderFormDemo";

function isStatus(value: string): value is DocStatus {
  return DOC_STATUSES.some((status) => status === value);
}

function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
}

/**
 * The document form template with a fake server: a header, the lines grid, the
 * footer, the action bar for the signed-in role and the tabs below. The status
 * select shows each state's actions; Support sees no Approve or Reject, an
 * Approver does.
 */
export function GalleryDocument() {
  const { t } = useTranslation("gallery");
  const [status, setStatus] = useState<DocStatus>("draft");
  const [sequence, setSequence] = useState(1);
  const number = documentNumber(sequence);
  const schema = useMemo(() => makeDocumentSchema(t), [t]);
  const form = useZodForm<DocumentInput, DocumentOutput>({
    schema,
    defaultValues: {
      customer: { number: "C-0002", name: GALLERY_CUSTOMERS[1]?.name ?? "" },
      customerPo: "CPO-7731",
      orderDate: today(),
      paymentTerms: "PREPAID",
      lines: startingLines(true),
    },
  });
  const actions = useDocumentActions(form, status, number, setStatus);
  const columns = useMemo<LineColumn[]>(
    () =>
      (
        [
          "lineNo",
          "item",
          "description",
          "quantity",
          "unitPrice",
          "amount",
          "availability",
          "remove",
        ] as const
      ).map((kind) => ({ kind, header: t(`lines.columns.${kind}`) })),
    [t],
  );
  const closed = status === "void" || status === "approved";

  return (
    <div className="space-y-s2">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="gallery-document-status" className="text-xs">
          {t("document.statusLabel")}
        </Label>
        <Select
          value={status}
          onValueChange={(value) => {
            if (isStatus(value)) setStatus(value);
          }}
        >
          <SelectTrigger
            id="gallery-document-status"
            size="sm"
            className="w-56"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOC_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`document.status.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DocumentForm
        formId="gallery-document"
        form={form}
        title={t("document.title", { number })}
        number={number}
        headingLevel={2}
        demo="synthetic"
        formLabel={t("document.formLabel")}
        header={<GalleryDocumentFields form={form} locked={closed} />}
        lines={
          <LinesGrid
            label={t("lines.tableLabel")}
            columns={columns}
            searchItems={searchGalleryItems}
            readOnly={closed}
          />
        }
        status={{
          family: DOC_FAMILY[status],
          label: t(`document.status.${status}`),
        }}
        attachments={[
          { id: "po", name: t("document.attachment"), size: "182 KB" },
        ]}
        actions={actions}
        draftKey="gallery.document-form"
        onSave={(values) => fakeDocumentSave(values, t)}
        onSaved={(_result, andNew) => {
          toast.done(t(andNew ? "document.savedNew" : "document.saved"));
          // The template has already reset the fields to nextValues.
          if (andNew) {
            setStatus("draft");
            setSequence((n) => n + 1);
          }
        }}
        nextValues={() => blankDocument(today())}
        {...(closed
          ? { saveBlocked: t(`document.blocked.closed.${status}`) }
          : {})}
        allowClean
        print={() => ({
          title: t("document.title", { number }),
          fields: [
            {
              label: t("document.fields.customerPo"),
              value: form.getValues("customerPo"),
            },
            {
              label: t("document.fields.orderDate"),
              value: form.getValues("orderDate"),
            },
          ],
        })}
        tabs={galleryDocumentTabs(t, status, number)}
      />
    </div>
  );
}
