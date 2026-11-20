import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MaskedField, VendorDetail } from "@orderpilot/shared";
import { SectionCard } from "@/components/common";
import { Badge } from "@/components/kit/Badge";
import { MaskedText } from "./pieces";
import { RecordTable, type RecordColumn } from "./RecordTable";

type BankAccount = VendorDetail["bankAccounts"][number];

/** The first bank field the server hid, which carries the reason it gave. */
function hiddenField(account: BankAccount | undefined): MaskedField | null {
  if (!account) return null;
  return (
    [
      account.bankName,
      account.bankAccountNo,
      account.swiftCode,
      account.iban,
    ].find((field) => field.masked) ?? null
  );
}

/**
 * The vendor's bank accounts. A role that may read them sees the table, under
 * a plain mark of who may: it is the normal state for Finance, not a warning.
 * A role that may not sees one line with the server's reason, because a table
 * of dots tells it nothing more.
 */
export function BankAccounts({ vendor }: { vendor: VendorDetail }) {
  const { t } = useTranslation("master-data");
  const { t: tc } = useTranslation("components");
  const hidden = hiddenField(vendor.bankAccounts[0]);
  // The mark is a claim about accounts that were sent unmasked, so a vendor
  // with none has nothing to mark. The server's answer decides, never the role.
  const readable = vendor.bankAccounts.length > 0 && hidden === null;
  const columns: RecordColumn<BankAccount>[] = [
    {
      id: "code",
      header: t("vendor.bank.code"),
      cell: (account) => <span className="font-mono">{account.code}</span>,
    },
    {
      id: "bankName",
      header: t("vendor.bank.name"),
      cell: (account) => <MaskedText field={account.bankName} mono={false} />,
    },
    {
      id: "bankAccountNo",
      header: t("vendor.bank.accountNo"),
      cell: (account) => <MaskedText field={account.bankAccountNo} />,
    },
    {
      id: "swiftCode",
      header: t("vendor.bank.swift"),
      cell: (account) => <MaskedText field={account.swiftCode} />,
    },
    {
      id: "iban",
      header: t("vendor.bank.iban"),
      cell: (account) => <MaskedText field={account.iban} />,
    },
  ];
  return (
    <SectionCard
      title={t("vendor.bank.title")}
      actions={
        readable ? (
          <Badge variant="secondary">
            <Lock aria-hidden="true" />
            {t("vendor.bank.financeOnly")}
          </Badge>
        ) : undefined
      }
    >
      {hidden ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" aria-hidden="true" />
          {tc(`masked.reasons.${hidden.reason ?? "bankDetails"}`)}
        </p>
      ) : (
        <RecordTable
          caption={t("vendor.bank.title")}
          columns={columns}
          rows={vendor.bankAccounts}
          rowKey={(account) => account.code}
          emptyText={t("vendor.bank.empty")}
        />
      )}
    </SectionCard>
  );
}
