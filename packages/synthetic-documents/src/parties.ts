import type { Customer } from "@orderpilot/synthetic-data";

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

/** Spectra's side of every document. The postcode is not a real one. */
export const SELLER: Party = {
  name: "Spectra Innovations Pte Ltd",
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

interface Place {
  city: string;
  /** Where the goods are shipped to, for the incoterm. */
  port: string;
  country: string;
  postcode: string;
}

const PLACES: Readonly<
  Record<Customer["countryRegionCode"], readonly Place[]>
> = {
  IN: [
    { city: "Chennai", port: "Chennai", country: "India", postcode: "600 000" },
    {
      city: "Mumbai",
      port: "Nhava Sheva",
      country: "India",
      postcode: "400 000",
    },
    { city: "Kochi", port: "Kochi", country: "India", postcode: "682 000" },
  ],
  LK: [
    {
      city: "Colombo",
      port: "Colombo",
      country: "Sri Lanka",
      postcode: "00100",
    },
    { city: "Kandy", port: "Colombo", country: "Sri Lanka", postcode: "20000" },
  ],
  BD: [
    {
      city: "Dhaka",
      port: "Chattogram",
      country: "Bangladesh",
      postcode: "1200",
    },
    {
      city: "Chattogram",
      port: "Chattogram",
      country: "Bangladesh",
      postcode: "4000",
    },
  ],
  PK: [
    {
      city: "Karachi",
      port: "Karachi",
      country: "Pakistan",
      postcode: "74000",
    },
    { city: "Lahore", port: "Karachi", country: "Pakistan", postcode: "54000" },
  ],
  AE: [
    {
      city: "Dubai",
      port: "Jebel Ali",
      country: "United Arab Emirates",
      postcode: "PO Box 00000",
    },
    {
      city: "Sharjah",
      port: "Jebel Ali",
      country: "United Arab Emirates",
      postcode: "PO Box 00000",
    },
  ],
};

const STREETS = [
  "Harbour Link Road",
  "Spice Quay Street",
  "Mill Lane",
  "Lantern Court",
  "Tidewater Avenue",
  "Old Customs Road",
  "Palm Terrace",
  "Anchor Street",
] as const;

function customerIndex(customer: Customer): number {
  return Number(customer.no.slice(2)) - 1;
}

export function placeOf(customer: Customer): Place {
  const places = PLACES[customer.countryRegionCode];
  const place = places[customerIndex(customer) % places.length];
  if (!place) throw new Error(`No place for ${customer.no}`);
  return place;
}

/** The customer's office: where the invoice goes. */
export function billTo(customer: Customer): Party {
  const place = placeOf(customer);
  const n = customerIndex(customer);
  const street = STREETS[n % STREETS.length] ?? STREETS[0];
  return {
    name: customer.name,
    address: [
      `${String(12 + ((n * 7) % 80))} ${street}`,
      `${place.city} ${place.postcode}`,
      place.country,
    ],
  };
}

/** Their warehouse, which is a different address from the office. */
export function shipTo(customer: Customer): Party {
  const place = placeOf(customer);
  const n = customerIndex(customer);
  const street = STREETS[(n + 3) % STREETS.length] ?? STREETS[0];
  return {
    name: `${customer.name} (Warehouse)`,
    address: [
      `Godown ${String(1 + (n % 9))}, ${street}`,
      `${place.city} ${place.postcode}`,
      place.country,
    ],
  };
}
