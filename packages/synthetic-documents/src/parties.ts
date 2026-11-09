import {
  COUNTRY_NAMES,
  type CountryCode,
  type Customer,
  type SampleOrder,
} from "@orderpilot/synthetic-data";

export interface Party {
  name: string;
  /** One line each, without the name. */
  address: string[];
}

export interface BankDetails {
  beneficiary: string;
  bankName: string;
  accountNo: string;
  swiftCode: string;
}

/**
 * Spectra's side of every document, as a fictional demo company: the data
 * rules ask for no real company, and a demo account is not the client's own.
 * The postcode is not a real one.
 */
export const SELLER: Party = {
  name: "Spectra Demo Pte Ltd",
  address: ["18 Demo Quay, #00-00", "Singapore 000000"],
};

/**
 * Obviously fake, in the style of the vendor accounts in the synthetic data:
 * all zeros, an unassigned bank code, and a name that says so.
 */
export const SELLER_BANK: BankDetails = {
  beneficiary: SELLER.name,
  bankName: "Demo Bank (not a real bank)",
  accountNo: "0000 0000 0000",
  swiftCode: "DEMOZZ00",
};

/** Where goods for a country are shipped to, for the incoterm. */
const PORTS: Readonly<Record<CountryCode, string>> = {
  AE: "Jebel Ali",
  PK: "Karachi",
  LK: "Colombo",
  MV: "Male",
  IN: "Nhava Sheva",
  NP: "Kolkata",
  BD: "Chattogram",
  VN: "Ho Chi Minh City",
  SG: "Singapore",
  ID: "Jakarta",
  MY: "Port Klang",
};

export function portOf(customer: Customer): string {
  return PORTS[customer.countryRegionCode];
}

function party(
  name: string,
  place: Pick<
    Customer,
    | "addressLine1"
    | "addressLine2"
    | "city"
    | "postalCode"
    | "countryRegionCode"
  >,
): Party {
  return {
    name,
    address: [
      `${place.addressLine1}, ${place.addressLine2}`,
      `${place.city} ${place.postalCode}`,
      COUNTRY_NAMES[place.countryRegionCode],
    ],
  };
}

/** The customer's office: where the invoice goes. */
export function billTo(customer: Customer): Party {
  return party(customer.name, customer);
}

/** Where the order's goods go, as the dataset says. */
export function shipTo(order: SampleOrder): Party {
  return party(order.shipTo.name, order.shipTo);
}
