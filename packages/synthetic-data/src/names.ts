import type { Role } from "@orderpilot/shared";
import type { ItemCategory } from "./types.js";

// Every name below is invented. Nothing is taken from a real company, brand or
// person; the trading names only sound like the places they trade in.

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

export interface BrandSpec {
  readonly name: string;
  readonly category: ItemCategory;
}

/** Four brands a category. A product manager owns the brands of one category. */
export const BRANDS: readonly BrandSpec[] = [
  { name: "Norvale", category: "IT" },
  { name: "Kelmora", category: "IT" },
  { name: "Tessaro", category: "IT" },
  { name: "Dravik", category: "IT" },
  { name: "Vantora", category: "SURVEILLANCE" },
  { name: "Quorrin", category: "SURVEILLANCE" },
  { name: "Ashgrove", category: "SURVEILLANCE" },
  { name: "Soltera", category: "SURVEILLANCE" },
  { name: "Brindlewick", category: "ACCESSORIES" },
  { name: "Emberlyn", category: "ACCESSORIES" },
  { name: "Zephrine", category: "ACCESSORIES" },
  { name: "Haldane", category: "ACCESSORIES" },
];

export interface ProductSpec {
  readonly name: string;
  readonly code: string;
  /** Unit price range in USD for the standard variant. */
  readonly price: readonly [number, number];
  /** Unit cost as a share of the price. */
  readonly cost: number;
  /** Usual order quantities, smallest to largest. */
  readonly quantities: readonly number[];
}

const BULK = [20, 40, 50, 100, 150, 200] as const;
const MID = [10, 20, 30, 50, 80, 120] as const;
const FEW = [4, 6, 10, 12, 20, 30] as const;

export const PRODUCTS: Readonly<Record<ItemCategory, readonly ProductSpec[]>> =
  {
    IT: [
      {
        name: "Wireless Mouse",
        code: "MS",
        price: [14, 22],
        cost: 0.55,
        quantities: BULK,
      },
      {
        name: "Mechanical Keyboard",
        code: "KB",
        price: [38, 70],
        cost: 0.6,
        quantities: MID,
      },
      {
        name: "USB Hub 4-Port",
        code: "HB",
        price: [9, 18],
        cost: 0.5,
        quantities: BULK,
      },
      {
        name: "24-inch Monitor",
        code: "MN",
        price: [110, 160],
        cost: 0.72,
        quantities: FEW,
      },
      {
        name: "SSD 512 GB",
        code: "SD",
        price: [42, 60],
        cost: 0.7,
        quantities: MID,
      },
      {
        name: "Wi-Fi Router AX1800",
        code: "RT",
        price: [55, 90],
        cost: 0.66,
        quantities: MID,
      },
      {
        name: "Network Switch 8-Port",
        code: "SW",
        price: [28, 48],
        cost: 0.62,
        quantities: MID,
      },
      {
        name: "Laptop Charger 65 W",
        code: "CH",
        price: [16, 28],
        cost: 0.5,
        quantities: BULK,
      },
      {
        name: "Webcam 1080p",
        code: "WC",
        price: [24, 44],
        cost: 0.57,
        quantities: MID,
      },
      {
        name: "Docking Station",
        code: "DK",
        price: [60, 110],
        cost: 0.64,
        quantities: FEW,
      },
    ],
    SURVEILLANCE: [
      {
        name: "Dome Camera 2 MP",
        code: "DC",
        price: [32, 52],
        cost: 0.6,
        quantities: MID,
      },
      {
        name: "Bullet Camera 4 MP",
        code: "BC",
        price: [44, 78],
        cost: 0.62,
        quantities: MID,
      },
      {
        name: "PTZ Camera 5 MP",
        code: "PZ",
        price: [180, 320],
        cost: 0.7,
        quantities: FEW,
      },
      {
        name: "NVR 8-Channel",
        code: "N8",
        price: [120, 190],
        cost: 0.68,
        quantities: FEW,
      },
      {
        name: "NVR 16-Channel",
        code: "N6",
        price: [210, 340],
        cost: 0.7,
        quantities: FEW,
      },
      {
        name: "PoE Switch 8-Port",
        code: "PS",
        price: [60, 95],
        cost: 0.64,
        quantities: FEW,
      },
      {
        name: "Surveillance Drive 4 TB",
        code: "HD",
        price: [95, 130],
        cost: 0.78,
        quantities: MID,
      },
      {
        name: "Camera Power Adapter 12 V",
        code: "PA",
        price: [5, 9],
        cost: 0.5,
        quantities: BULK,
      },
      {
        name: "Door Sensor Kit",
        code: "DS",
        price: [11, 20],
        cost: 0.55,
        quantities: MID,
      },
      {
        name: "Alarm Siren Unit",
        code: "AS",
        price: [15, 26],
        cost: 0.55,
        quantities: MID,
      },
    ],
    ACCESSORIES: [
      {
        name: "USB-C Cable 1 m",
        code: "UC",
        price: [4, 8],
        cost: 0.45,
        quantities: BULK,
      },
      {
        name: "HDMI Cable 2 m",
        code: "HC",
        price: [5, 10],
        cost: 0.45,
        quantities: BULK,
      },
      {
        name: "Power Bank 10000 mAh",
        code: "PB",
        price: [18, 30],
        cost: 0.6,
        quantities: MID,
      },
      {
        name: "Bluetooth Speaker",
        code: "BS",
        price: [20, 45],
        cost: 0.58,
        quantities: MID,
      },
      {
        name: "LED Desk Lamp",
        code: "DL",
        price: [12, 25],
        cost: 0.5,
        quantities: MID,
      },
      {
        name: "Laptop Sleeve 15 in",
        code: "LS",
        price: [9, 17],
        cost: 0.5,
        quantities: BULK,
      },
      {
        name: "Mouse Pad Large",
        code: "MP",
        price: [3, 7],
        cost: 0.4,
        quantities: BULK,
      },
      {
        name: "Cable Organiser Set",
        code: "CO",
        price: [3, 6],
        cost: 0.4,
        quantities: BULK,
      },
      {
        name: "Wired Earbuds",
        code: "EB",
        price: [6, 14],
        cost: 0.5,
        quantities: BULK,
      },
      {
        name: "Screen Cleaning Kit",
        code: "SC",
        price: [2, 5],
        cost: 0.4,
        quantities: BULK,
      },
    ],
  };

/** Three variants of each product; a brand lists the first 25 of its 30 combinations. */
export const VARIANTS = [
  { label: "", price: 1, code: "A" },
  { label: " Pro", price: 1.35, code: "B" },
  { label: " Lite", price: 0.8, code: "C" },
] as const;

export interface PersonSpec {
  readonly name: string;
  readonly role: Role;
  /** The category a product manager owns. */
  readonly category?: ItemCategory;
}

/** The first person of each role is the demo sign-in persona. */
export const TEAM: readonly PersonSpec[] = [
  { name: "Priya Nair", role: "PRODUCT_MANAGER", category: "IT" },
  { name: "Kavin Ramesh", role: "PRODUCT_MANAGER", category: "SURVEILLANCE" },
  { name: "Nadia Salleh", role: "PRODUCT_MANAGER", category: "ACCESSORIES" },
  { name: "Janet Lim", role: "APPROVER" },
  { name: "Mei Tan", role: "SUPPORT" },
  { name: "Daryl Foo", role: "SUPPORT" },
  { name: "Hafiz Rahman", role: "WAREHOUSE" },
  { name: "Vikram Soh", role: "WAREHOUSE" },
  { name: "Grace Ong", role: "FINANCE" },
  { name: "Imran Aziz", role: "FINANCE" },
  { name: "Arjun Mehta", role: "LOGISTICS" },
  { name: "Sandra Yeo", role: "LOGISTICS" },
  { name: "Sophia Chen", role: "MANAGEMENT" },
];
