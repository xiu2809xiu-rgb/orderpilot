import type { TFunction } from "i18next";
import type { CustomerDetail } from "@orderpilot/shared";
import { paymentTermsLabel } from "./paymentTerms";
import { MaskedMoney, countryName, type KeyFact } from "./pieces";

/**
 * The facts under a customer's header. The address and the tax registration
 * number are Business Central's own fields; here both are made up and fake.
 */
export function customerFacts(
  customer: CustomerDetail,
  t: TFunction,
): KeyFact[] {
  const address = [
    customer.addressLine1,
    customer.addressLine2,
    customer.city,
    customer.state,
    customer.postalCode,
    countryName(customer.countryRegionCode),
  ]
    .filter((part) => part !== "")
    .join(", ");
  return [
    {
      id: "country",
      label: t("customer.country"),
      value: countryName(customer.countryRegionCode),
    },
    {
      id: "currency",
      label: t("customer.currency"),
      value: customer.currencyCode,
    },
    {
      id: "terms",
      label: t("customer.paymentTerms"),
      value: paymentTermsLabel(t, customer.paymentTermsCode),
    },
    {
      id: "limit",
      label: t("customer.creditLimit"),
      value: <MaskedMoney field={customer.creditLimitLcy} />,
    },
    {
      id: "balance",
      label: t("customer.balance"),
      value: <MaskedMoney field={customer.balanceLcy} />,
    },
    { id: "address", label: t("customer.address"), value: address, wrap: true },
    {
      id: "tax",
      label: t("customer.taxRegistration"),
      value: (
        <span className="font-mono">{customer.taxRegistrationNumber}</span>
      ),
      wrap: true,
    },
  ];
}
