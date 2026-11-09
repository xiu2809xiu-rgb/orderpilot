import type { Role } from "@orderpilot/shared";

// The customers, vendors and people below are invented. Nothing is taken from
// a real company or person; the trading names only sound like the places they
// trade in. The brands, which are real names, live in catalogue-plan.ts.

type Country = "IN" | "LK" | "BD" | "PK" | "AE";

/** Eight customers a country. The first of each is listed first, so C-0001 to C-0005 keep their country. */
export const CUSTOMER_NAMES: readonly (readonly [string, Country])[] = [
  ["Quillon Harbour Traders", "IN"],
  ["Brindle Coast Imports", "LK"],
  ["Tamarell Palm Wholesale", "BD"],
  ["Verrick Bazaar Distribution", "PK"],
  ["Ostrel Ridge Trading", "AE"],
  ["Dhanvera Systems Pvt Ltd", "IN"],
  ["Selvaran Trading (Pvt) Ltd", "LK"],
  ["Padmora Electronics Ltd", "BD"],
  ["Chenavar Electronics (Pvt) Ltd", "PK"],
  ["Dunefall General Trading LLC", "AE"],
  ["Marundel Electronics Pvt Ltd", "IN"],
  ["Kandaleya Electronics (Pvt) Ltd", "LK"],
  ["Jamunia Trading Ltd", "BD"],
  ["Indora Technology (Pvt) Ltd", "PK"],
  ["Marjana Technology FZE", "AE"],
  ["Tejoran Distribution Pvt Ltd", "IN"],
  ["Sirimal Techtrade (Pvt) Ltd", "LK"],
  ["Shitalvi Technology Ltd", "BD"],
  ["Sulemar Traders (Pvt) Ltd", "PK"],
  ["Qasrel Electronics Trading LLC", "AE"],
  ["Kaluvani IT Supplies Pvt Ltd", "IN"],
  ["Galvera Office Systems (Pvt) Ltd", "LK"],
  ["Karnafel IT Traders Ltd", "BD"],
  ["Karakel Systems (Pvt) Ltd", "PK"],
  ["Hamriva Systems FZCO", "AE"],
  ["Ranvith Surveillance Traders", "IN"],
  ["Nuwaran Infotech (Pvt) Ltd", "LK"],
  ["Meghora Distribution Ltd", "BD"],
  ["Thalvani Supplies (Pvt) Ltd", "PK"],
  ["Sahelor IT Trading LLC", "AE"],
  ["Sundaraj Infotrade Pvt Ltd", "IN"],
  ["Dambera Security Supplies (Pvt) Ltd", "LK"],
  ["Banirupa Networks Ltd", "BD"],
  ["Multara Digital (Pvt) Ltd", "PK"],
  ["Wadiran Security FZE", "AE"],
  ["Vellamar Network Stores", "IN"],
  ["Lankor Digital Traders (Pvt) Ltd", "LK"],
  ["Surmaran Security Ltd", "BD"],
  ["Gwadren Security Trading (Pvt) Ltd", "PK"],
  ["Jebelor Distribution LLC", "AE"],
];

/** Payment terms in turn. The first five are the terms the earlier, smaller set used. */
export const PAYMENT_TERMS = [
  "30 DAYS",
  "PREPAID",
  "LC AT SIGHT",
  "50% ADVANCE",
  "30 DAYS",
  "30% DEPOSIT",
  "60 DAYS",
] as const;

/** The share of an order paid up front under each of those terms. */
export const PREPAYMENT_PERCENT: Readonly<Record<string, string>> = {
  PREPAID: "100",
  "50% ADVANCE": "50",
  "30% DEPOSIT": "30",
};

export const PRICE_GROUPS = ["DIST-A", "DIST-B", "RETAIL"] as const;

export const VENDOR_NAMES: readonly string[] = [
  "Halvorn Components Ltd",
  "Pelagia Source Co",
  "Quenby Origin Works",
  "Zentarro Electronics Co",
  "Oriel Vantage Technology",
  "Mirelle Optics Co",
  "Kestrin Devices Ltd",
  "Tolvane Networks Co",
  "Arbelle Power Systems",
  "Fennick Cable Works",
  "Draymar Storage Ltd",
  "Ilsmoor Peripherals Co",
];

export interface PersonSpec {
  readonly name: string;
  readonly role: Role;
  /** Routes each SPR to the approvers. Never owns or is assigned an order. */
  readonly sprCoordinator?: true;
}

/** The first person of each role is the demo sign-in persona. */
export const TEAM: readonly PersonSpec[] = [
  { name: "Priya Nair", role: "PRODUCT_MANAGER" },
  { name: "Kavin Ramesh", role: "PRODUCT_MANAGER" },
  { name: "Nadia Salleh", role: "PRODUCT_MANAGER" },
  { name: "Rachel Goh", role: "APPROVER" },
  { name: "Marcus Teo", role: "APPROVER" },
  { name: "Farah Ismail", role: "APPROVER" },
  { name: "Mei Tan", role: "SUPPORT" },
  { name: "Daryl Foo", role: "SUPPORT" },
  { name: "Michelle Lau", role: "SUPPORT", sprCoordinator: true },
  { name: "Hafiz Rahman", role: "WAREHOUSE" },
  { name: "Vikram Soh", role: "WAREHOUSE" },
  { name: "Grace Ong", role: "FINANCE" },
  { name: "Imran Aziz", role: "FINANCE" },
  { name: "Arjun Mehta", role: "LOGISTICS" },
  { name: "Sandra Yeo", role: "LOGISTICS" },
  { name: "Sophia Chen", role: "MANAGEMENT" },
];
