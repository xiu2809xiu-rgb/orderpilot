import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Field, NativeSelect } from "@/components/common/data-table/Field";
import { fromOptions, toOptions, type VersionPair } from "./versionsModel";

/**
 * The two PO versions to compare, as two native selects: the earlier one can be
 * any but the current one, and the later one is above it. Choosing an earlier
 * version at or above the later one moves the later one up by itself.
 */
export function ComparePicker({
  pair,
  current,
  onChoose,
}: {
  pair: VersionPair;
  current: number;
  onChoose: (choice: Partial<VersionPair>) => void;
}) {
  const { t } = useTranslation("directions-orders");
  const id = useId();
  const option = (n: number) => (
    <option key={n} value={n}>
      {t("order.versions.row", { n })}
    </option>
  );
  return (
    <div className="flex flex-wrap items-end gap-s2">
      <Field label={t("order.versions.compareFrom")} htmlFor={`${id}-from`}>
        <NativeSelect
          id={`${id}-from`}
          className="pointer-coarse:[&_select]:h-11"
          value={pair.from}
          onChange={(event) => {
            onChoose({ from: Number(event.target.value) });
          }}
        >
          {fromOptions(current).map(option)}
        </NativeSelect>
      </Field>
      <Field label={t("order.versions.compareTo")} htmlFor={`${id}-to`}>
        <NativeSelect
          id={`${id}-to`}
          className="pointer-coarse:[&_select]:h-11"
          value={pair.to}
          onChange={(event) => {
            onChoose({ to: Number(event.target.value) });
          }}
        >
          {toOptions(pair.from, current).map(option)}
        </NativeSelect>
      </Field>
    </div>
  );
}
