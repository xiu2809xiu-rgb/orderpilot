import { PAYMENT_TYPES, type OrderPayment } from "@orderpilot/shared";
import { useMutation } from "@tanstack/react-query";
import { useState, type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState, ErrorPanel, toast } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { workflowsConfirmPayment } from "@/lib/api/generated/endpoints/workflows/workflows";
import { formatAmount, formatDate } from "./format";

const SELECT_CLASS =
  "h-11 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";

/** What Finance asked for and has confirmed, and the form that confirms a payment with its type. */
export function PaymentPanel({
  orderNo,
  payment,
  canConfirm,
}: {
  orderNo: string;
  payment: OrderPayment;
  canConfirm: boolean;
}) {
  const { t } = useTranslation("workflows");
  const [type, setType] = useState<string>("prepayment");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [invalid, setInvalid] = useState(false);
  const confirm = useMutation({
    mutationFn: () =>
      workflowsConfirmPayment(orderNo, {
        paymentType: type as (typeof PAYMENT_TYPES)[number],
        amount,
        currencyCode: "USD",
        reference,
        paidOn,
      }),
    onSuccess: () =>
      toast.done(t("payment.toast.confirmed", { orderNo }), {
        description: `${formatAmount(amount)} USD`,
      }),
    onError: () => toast.failed(t("payment.toast.failed")),
  });

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    const ready =
      Number(amount) > 0 && reference.trim() !== "" && paidOn !== "";
    setInvalid(!ready);
    if (ready) confirm.mutate();
  }

  return (
    <div className="space-y-s3">
      <dl className="grid gap-s2 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">
            {t("payment.prepaymentPercent")}
          </dt>
          <dd data-numeric className="text-lg font-semibold">
            {payment.prepaymentPercent}%
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">
            {t("payment.amountDue")}
          </dt>
          <dd data-numeric className="text-lg font-semibold">
            {payment.amountDue
              ? `${formatAmount(payment.amountDue)} USD`
              : t("payment.noneDue")}
          </dd>
        </div>
      </dl>
      <div className="space-y-2">
        <h3 className="font-medium">{t("payment.confirmed")}</h3>
        {payment.confirmations.length === 0 ? (
          <EmptyState title={t("payment.noneConfirmed")} />
        ) : (
          <ul className="space-y-2">
            {payment.confirmations.map((paid) => (
              <li key={paid.id} className="rounded-lg border p-s2 text-sm">
                <span className="font-medium">
                  {t(`payment.types.${paid.paymentType}`)}
                </span>{" "}
                <span data-numeric>
                  {formatAmount(paid.amount)} {paid.currencyCode}
                </span>
                {" · "}
                {paid.reference}
                {" · "}
                {formatDate(paid.paidOn)}
              </li>
            ))}
          </ul>
        )}
      </div>
      {canConfirm ? (
        <form
          onSubmit={submit}
          noValidate
          className="space-y-s2 border-t pt-s3"
        >
          <h3 className="font-medium">{t("payment.form.heading")}</h3>
          <div className="grid gap-s2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="pay-type">{t("payment.form.type")}</Label>
              <select
                id="pay-type"
                className={SELECT_CLASS}
                value={type}
                onChange={(event) => {
                  setType(event.target.value);
                }}
              >
                {PAYMENT_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {t(`payment.types.${value}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pay-amount">{t("payment.form.amount")}</Label>
              <Input
                id="pay-amount"
                inputMode="decimal"
                className="h-11"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pay-ref">{t("payment.form.reference")}</Label>
              <Input
                id="pay-ref"
                className="h-11"
                value={reference}
                onChange={(event) => {
                  setReference(event.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pay-date">{t("payment.form.paidOn")}</Label>
              <Input
                id="pay-date"
                type="date"
                className="h-11"
                value={paidOn}
                onChange={(event) => {
                  setPaidOn(event.target.value);
                }}
              />
            </div>
          </div>
          {invalid ? (
            <p role="alert" className="text-sm text-destructive">
              {t("payment.form.invalid")}
            </p>
          ) : null}
          {confirm.isError ? <ErrorPanel error={confirm.error} /> : null}
          {confirm.isSuccess ? (
            <p
              role="status"
              className="rounded-lg bg-warning-surface px-s2 py-s1 text-sm text-warning"
            >
              {confirm.data.data.message}
            </p>
          ) : null}
          <Button
            type="submit"
            size="lg"
            className="min-h-11"
            disabled={confirm.isPending}
          >
            {confirm.isPending
              ? t("payment.form.submitting")
              : t("payment.form.submit")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
