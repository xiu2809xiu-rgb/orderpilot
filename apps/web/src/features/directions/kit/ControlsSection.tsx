import { CircleAlert, Plus, Upload } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KitSection } from "./KitSection";

/** Buttons (one primary) and fields: a visible label, help that stays, an error under the field. */
export function ControlsSection() {
  const { t } = useTranslation("directions-kit");
  const poId = useId();
  const shipId = useId();
  const noteId = useId();
  return (
    <KitSection title={t("sections.controls")}>
      <h3 className="fs-13 font-medium">{t("controls.buttons")}</h3>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button>
          <Plus aria-hidden="true" />
          {t("controls.primary")}
        </Button>
        <Button variant="outline">
          <Upload aria-hidden="true" />
          {t("controls.secondary")}
        </Button>
        <Button variant="secondary">{t("controls.outline")}</Button>
        <Button variant="ghost">{t("controls.ghost")}</Button>
        <Button
          variant="destructive"
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90"
        >
          {t("controls.danger")}
        </Button>
        <Button disabled>{t("controls.disabled")}</Button>
      </div>
      <h3 className="fs-13 mt-5 font-medium">{t("controls.fields")}</h3>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={poId} className="fs-13">
            {t("controls.labelPo")}
          </Label>
          <Input
            id={poId}
            defaultValue={t("controls.valuePo")}
            aria-describedby={`${poId}-help`}
            className="numeral"
          />
          <p id={`${poId}-help`} className="fs-12 text-muted-foreground">
            {t("controls.helpPo")}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={shipId} className="fs-13">
            {t("controls.labelShip")}
          </Label>
          <Input
            id={shipId}
            aria-invalid="true"
            aria-describedby={`${shipId}-error`}
          />
          <p
            id={`${shipId}-error`}
            className="fs-12 flex items-start gap-1.5 text-destructive"
          >
            <CircleAlert
              className="mt-0.5 size-3.5 shrink-0"
              aria-hidden="true"
            />
            {t("controls.errorShip")}
          </p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={noteId} className="fs-13">
            {t("controls.labelNote")}
            <span className="font-normal text-muted-foreground">
              {t("controls.optional")}
            </span>
          </Label>
          <Input id={noteId} />
        </div>
      </div>
    </KitSection>
  );
}
