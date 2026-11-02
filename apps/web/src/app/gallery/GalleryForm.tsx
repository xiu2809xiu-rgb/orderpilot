import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/common";
import {
  FormActions,
  FormShell,
  SaveButton,
  useDraft,
  useFormSave,
  useSaveShortcut,
  useZodForm,
} from "@/components/form";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GalleryFormFields } from "./GalleryFormFields";
import {
  ANSWERS,
  fakeSave,
  fakeSearch,
  GALLERY_CUSTOMERS,
  GALLERY_ITEMS,
  makeOrderSchema,
  orderDefaults,
  type FakeAnswer,
  type OrderInput,
  type OrderOutput,
} from "./orderFormDemo";

/** Masked fields are never kept in a draft. This one stands in for them. */
const LEFT_OUT_OF_DRAFTS = ["creditLimit"] as const;

function isAnswer(value: string): value is FakeAnswer {
  return ANSWERS.some((answer) => answer === value);
}

/**
 * The form kit at work on a sales order header. Its save is faked, so it can
 * show each server answer, and its draft survives a reload with no API.
 */
export function GalleryForm() {
  const { t } = useTranslation("gallery");
  const [answer, setAnswer] = useState<FakeAnswer>("saves");
  const answerNow = useRef(answer);
  useEffect(() => {
    answerNow.current = answer;
  }, [answer]);
  const schema = useMemo(() => makeOrderSchema(t), [t]);
  const form = useZodForm<OrderInput, OrderOutput>({
    schema,
    defaultValues: orderDefaults(),
  });
  const draft = useDraft("gallery.sales-order-header", form, {
    exclude: LEFT_OUT_OF_DRAFTS,
  });
  const searches = useMemo(() => {
    const fails = () => answerNow.current === "searchFails";
    return {
      customers: fakeSearch(GALLERY_CUSTOMERS, fails),
      items: fakeSearch(GALLERY_ITEMS, fails),
    };
  }, []);
  const save = useFormSave(form, {
    draft,
    onSave: (values) => fakeSave(answerNow.current, values, t),
    onSaved: () => {
      toast.done(t("form.saved"));
    },
  });
  useSaveShortcut(form, save);

  return (
    <div className="space-y-s2">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="gallery-form-answer" className="text-xs">
          {t("form.answer.label")}
        </Label>
        <Select
          value={answer}
          onValueChange={(value) => {
            if (isAnswer(value)) setAnswer(value);
          }}
        >
          <SelectTrigger id="gallery-form-answer" size="sm" className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ANSWERS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`form.answer.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <FormShell form={form} draft={draft} aria-label={t("form.formLabel")}>
        <GalleryFormFields
          control={form.control}
          searchCustomers={searches.customers}
          searchItems={searches.items}
        />
        <FormActions>
          <SaveButton form={form} onSave={save} variant="outline" />
        </FormActions>
      </FormShell>
    </div>
  );
}
