import type { ItemCategory } from "./types.js";

// The brand names below are real names Spectra carries (ADR 0050). Everything
// else is invented: the part numbers, the products and every price. No logo
// and no claim that a brand supplied or endorses any of it.

export interface BrandSpec {
  readonly name: string;
  /** Where most of its items sit; a brand's items may sit in two categories. */
  readonly category: ItemCategory;
}

export const BRANDS: readonly BrandSpec[] = [
  { name: "Dell", category: "PCS" },
  { name: "HP", category: "PCS" },
  { name: "Lenovo", category: "PCS" },
  { name: "Acer", category: "PCS" },
  { name: "Asus", category: "PCS" },
  { name: "Samsung", category: "PERIPHERALS" },
  { name: "Intel", category: "COMPONENTS" },
  { name: "Seagate", category: "COMPONENTS" },
  { name: "Toshiba", category: "COMPONENTS" },
  { name: "Kioxia", category: "COMPONENTS" },
  { name: "Lexar", category: "COMPONENTS" },
  { name: "Verbatim", category: "COMPONENTS" },
  { name: "TeamGroup", category: "COMPONENTS" },
  { name: "Cooler Master", category: "COMPONENTS" },
  { name: "Hikvision", category: "SECURITY" },
  { name: "Honeywell", category: "SECURITY" },
  { name: "TP-Link", category: "NETWORKING" },
  { name: "Cudy", category: "NETWORKING" },
  { name: "Aruba", category: "NETWORKING" },
  { name: "HPE", category: "ENTERPRISE" },
  { name: "Supermicro", category: "ENTERPRISE" },
  { name: "Vertiv", category: "ENTERPRISE" },
];

/** Who owns each brand. Open until Spectra confirms its product lines. */
export const BRAND_OWNERS: Readonly<Record<string, string>> = {
  Dell: "Priya Nair",
  HP: "Priya Nair",
  Lenovo: "Priya Nair",
  Acer: "Priya Nair",
  Asus: "Priya Nair",
  Samsung: "Priya Nair",
  Hikvision: "Kavin Ramesh",
  Honeywell: "Kavin Ramesh",
  "TP-Link": "Kavin Ramesh",
  Cudy: "Kavin Ramesh",
  Aruba: "Kavin Ramesh",
  HPE: "Kavin Ramesh",
  Supermicro: "Kavin Ramesh",
  Vertiv: "Kavin Ramesh",
  Intel: "Nadia Salleh",
  Seagate: "Nadia Salleh",
  Toshiba: "Nadia Salleh",
  Kioxia: "Nadia Salleh",
  Lexar: "Nadia Salleh",
  Verbatim: "Nadia Salleh",
  TeamGroup: "Nadia Salleh",
  "Cooler Master": "Nadia Salleh",
};

export interface ProductClass {
  readonly name: string;
  readonly category: ItemCategory;
  /** Unit price range in USD. */
  readonly price: readonly [number, number];
  /** Unit cost as a share of the price. */
  readonly cost: number;
  /** Usual order quantities, smallest to largest. */
  readonly quantities: readonly number[];
  /** Days from the vendor's order to the goods arriving, lowest to highest. */
  readonly leadTimeDays: readonly [number, number];
}

const BULK = [20, 40, 50, 100, 150, 200] as const;
const MID = [10, 20, 30, 50, 80, 120] as const;
const FEW = [4, 6, 10, 12, 20, 30] as const;
const RARE = [1, 2, 3, 4, 5, 6] as const;

/**
 * Lead times follow what Spectra said on 5 Nov: three to four weeks for
 * notebooks, up to six months for components.
 */
export const PRODUCT_CLASSES = {
  nb14: {
    name: "Notebook 14-inch",
    category: "PCS",
    price: [380, 900],
    cost: 0.86,
    quantities: FEW,
    leadTimeDays: [21, 28],
  },
  nb15: {
    name: "Notebook 15.6-inch Business",
    category: "PCS",
    price: [520, 1_100],
    cost: 0.87,
    quantities: FEW,
    leadTimeDays: [21, 28],
  },
  desktop: {
    name: "Desktop Tower",
    category: "PCS",
    price: [450, 950],
    cost: 0.85,
    quantities: FEW,
    leadTimeDays: [28, 35],
  },
  aio: {
    name: "All-in-One 24-inch",
    category: "PCS",
    price: [650, 1_200],
    cost: 0.86,
    quantities: FEW,
    leadTimeDays: [28, 35],
  },
  mini: {
    name: "Mini PC",
    category: "PCS",
    price: [280, 520],
    cost: 0.84,
    quantities: FEW,
    leadTimeDays: [28, 35],
  },
  ws: {
    name: "Workstation Notebook",
    category: "PCS",
    price: [1_100, 1_900],
    cost: 0.88,
    quantities: RARE,
    leadTimeDays: [28, 42],
  },
  mon24: {
    name: "Monitor 24-inch",
    category: "PERIPHERALS",
    price: [110, 190],
    cost: 0.82,
    quantities: FEW,
    leadTimeDays: [35, 56],
  },
  mon27: {
    name: "Monitor 27-inch",
    category: "PERIPHERALS",
    price: [160, 300],
    cost: 0.82,
    quantities: FEW,
    leadTimeDays: [35, 56],
  },
  mon32: {
    name: "Curved Monitor 32-inch",
    category: "PERIPHERALS",
    price: [220, 480],
    cost: 0.8,
    quantities: FEW,
    leadTimeDays: [35, 56],
  },
  mouse: {
    name: "Wireless Mouse",
    category: "PERIPHERALS",
    price: [12, 28],
    cost: 0.65,
    quantities: BULK,
    leadTimeDays: [35, 60],
  },
  kb: {
    name: "Keyboard",
    category: "PERIPHERALS",
    price: [20, 60],
    cost: 0.66,
    quantities: MID,
    leadTimeDays: [35, 60],
  },
  webcam: {
    name: "Webcam 1080p",
    category: "PERIPHERALS",
    price: [24, 60],
    cost: 0.7,
    quantities: MID,
    leadTimeDays: [35, 60],
  },
  dock: {
    name: "Docking Station",
    category: "PERIPHERALS",
    price: [80, 200],
    cost: 0.75,
    quantities: FEW,
    leadTimeDays: [35, 60],
  },
  charger: {
    name: "Laptop Charger 65 W",
    category: "PERIPHERALS",
    price: [16, 32],
    cost: 0.65,
    quantities: BULK,
    leadTimeDays: [35, 60],
  },
  headset: {
    name: "Headset",
    category: "PERIPHERALS",
    price: [20, 80],
    cost: 0.68,
    quantities: MID,
    leadTimeDays: [35, 60],
  },
  printer: {
    name: "Laser Printer",
    category: "PERIPHERALS",
    price: [120, 380],
    cost: 0.8,
    quantities: FEW,
    leadTimeDays: [35, 60],
  },
  cpu: {
    name: "Desktop Processor",
    category: "COMPONENTS",
    price: [120, 480],
    cost: 0.9,
    quantities: FEW,
    leadTimeDays: [90, 180],
  },
  ssd: {
    name: "SSD 1 TB NVMe",
    category: "COMPONENTS",
    price: [55, 110],
    cost: 0.8,
    quantities: MID,
    leadTimeDays: [90, 180],
  },
  portssd: {
    name: "Portable SSD 1 TB",
    category: "COMPONENTS",
    price: [75, 130],
    cost: 0.8,
    quantities: MID,
    leadTimeDays: [90, 180],
  },
  hdd: {
    name: "Internal Hard Drive 4 TB",
    category: "COMPONENTS",
    price: [85, 130],
    cost: 0.82,
    quantities: MID,
    leadTimeDays: [90, 180],
  },
  survhdd: {
    name: "Surveillance Hard Drive 4 TB",
    category: "COMPONENTS",
    price: [90, 135],
    cost: 0.82,
    quantities: MID,
    leadTimeDays: [90, 180],
  },
  microsd: {
    name: "microSD Card 128 GB",
    category: "COMPONENTS",
    price: [9, 22],
    cost: 0.7,
    quantities: BULK,
    leadTimeDays: [90, 180],
  },
  usb: {
    name: "USB Flash Drive 64 GB",
    category: "COMPONENTS",
    price: [6, 13],
    cost: 0.7,
    quantities: BULK,
    leadTimeDays: [90, 150],
  },
  ddr5: {
    name: "DDR5 Memory 16 GB",
    category: "COMPONENTS",
    price: [38, 70],
    cost: 0.82,
    quantities: MID,
    leadTimeDays: [90, 180],
  },
  cooler: {
    name: "CPU Cooler",
    category: "COMPONENTS",
    price: [25, 60],
    cost: 0.7,
    quantities: MID,
    leadTimeDays: [60, 120],
  },
  case: {
    name: "PC Case",
    category: "COMPONENTS",
    price: [45, 110],
    cost: 0.72,
    quantities: MID,
    leadTimeDays: [60, 120],
  },
  psu: {
    name: "Power Supply 650 W",
    category: "COMPONENTS",
    price: [50, 95],
    cost: 0.74,
    quantities: MID,
    leadTimeDays: [60, 120],
  },
  dvd: {
    name: "Blank DVD-R 50 Pack",
    category: "COMPONENTS",
    price: [9, 18],
    cost: 0.7,
    quantities: BULK,
    leadTimeDays: [90, 150],
  },
  srvcpu: {
    name: "Server Processor",
    category: "ENTERPRISE",
    price: [700, 2_400],
    cost: 0.88,
    quantities: RARE,
    leadTimeDays: [90, 180],
  },
  rack1u: {
    name: "Rack Server 1U",
    category: "ENTERPRISE",
    price: [2_200, 4_200],
    cost: 0.86,
    quantities: RARE,
    leadTimeDays: [60, 120],
  },
  rack2u: {
    name: "Rack Server 2U",
    category: "ENTERPRISE",
    price: [3_000, 4_500],
    cost: 0.86,
    quantities: RARE,
    leadTimeDays: [60, 120],
  },
  tower: {
    name: "Tower Server",
    category: "ENTERPRISE",
    price: [1_400, 2_800],
    cost: 0.85,
    quantities: RARE,
    leadTimeDays: [60, 120],
  },
  srvmem: {
    name: "Server Memory 32 GB",
    category: "ENTERPRISE",
    price: [140, 260],
    cost: 0.82,
    quantities: [4, 8, 12, 16, 24, 32],
    leadTimeDays: [60, 120],
  },
  srvssd: {
    name: "Server SSD 1.92 TB",
    category: "ENTERPRISE",
    price: [220, 420],
    cost: 0.8,
    quantities: [4, 6, 8, 12, 16, 24],
    leadTimeDays: [60, 120],
  },
  srvmb: {
    name: "Server Motherboard",
    category: "ENTERPRISE",
    price: [300, 560],
    cost: 0.84,
    quantities: [2, 4, 6, 8, 10, 12],
    leadTimeDays: [60, 120],
  },
  nic: {
    name: "Network Adapter 10GbE",
    category: "ENTERPRISE",
    price: [90, 200],
    cost: 0.8,
    quantities: MID,
    leadTimeDays: [45, 90],
  },
  ups1500: {
    name: "UPS 1500 VA",
    category: "ENTERPRISE",
    price: [280, 560],
    cost: 0.78,
    quantities: FEW,
    leadTimeDays: [45, 90],
  },
  ups3k: {
    name: "UPS 3 kVA Rack",
    category: "ENTERPRISE",
    price: [900, 1_600],
    cost: 0.8,
    quantities: RARE,
    leadTimeDays: [45, 90],
  },
  pdu: {
    name: "Rack PDU",
    category: "ENTERPRISE",
    price: [90, 220],
    cost: 0.75,
    quantities: MID,
    leadTimeDays: [45, 90],
  },
  rack42: {
    name: "Server Rack Cabinet 42U",
    category: "ENTERPRISE",
    price: [650, 1_200],
    cost: 0.78,
    quantities: RARE,
    leadTimeDays: [45, 90],
  },
  rail: {
    name: "Rack Rail Kit",
    category: "ENTERPRISE",
    price: [40, 90],
    cost: 0.7,
    quantities: MID,
    leadTimeDays: [45, 90],
  },
  dome: {
    name: "Dome Camera 4 MP",
    category: "SECURITY",
    price: [38, 85],
    cost: 0.62,
    quantities: MID,
    leadTimeDays: [30, 75],
  },
  bullet: {
    name: "Bullet Camera 4 MP",
    category: "SECURITY",
    price: [45, 95],
    cost: 0.62,
    quantities: MID,
    leadTimeDays: [30, 75],
  },
  ptz: {
    name: "PTZ Camera 5 MP",
    category: "SECURITY",
    price: [180, 420],
    cost: 0.7,
    quantities: FEW,
    leadTimeDays: [30, 75],
  },
  nvr8: {
    name: "NVR 8-Channel",
    category: "SECURITY",
    price: [120, 240],
    cost: 0.7,
    quantities: FEW,
    leadTimeDays: [30, 75],
  },
  nvr32: {
    name: "NVR 32-Channel",
    category: "SECURITY",
    price: [380, 820],
    cost: 0.72,
    quantities: FEW,
    leadTimeDays: [30, 75],
  },
  access: {
    name: "Access Control Terminal",
    category: "SECURITY",
    price: [95, 260],
    cost: 0.7,
    quantities: FEW,
    leadTimeDays: [30, 75],
  },
  intercom: {
    name: "Video Intercom Kit",
    category: "SECURITY",
    price: [90, 210],
    cost: 0.68,
    quantities: FEW,
    leadTimeDays: [30, 75],
  },
  alarm: {
    name: "Alarm Control Panel",
    category: "SECURITY",
    price: [120, 300],
    cost: 0.68,
    quantities: FEW,
    leadTimeDays: [30, 75],
  },
  sensor: {
    name: "Door Sensor Kit",
    category: "SECURITY",
    price: [12, 26],
    cost: 0.55,
    quantities: MID,
    leadTimeDays: [30, 75],
  },
  motion: {
    name: "Motion Detector",
    category: "SECURITY",
    price: [14, 34],
    cost: 0.55,
    quantities: MID,
    leadTimeDays: [30, 75],
  },
  adapter: {
    name: "Camera Power Adapter 12 V",
    category: "SECURITY",
    price: [5, 10],
    cost: 0.5,
    quantities: BULK,
    leadTimeDays: [30, 60],
  },
  ax1800: {
    name: "Wi-Fi 6 Router AX1800",
    category: "NETWORKING",
    price: [40, 110],
    cost: 0.68,
    quantities: MID,
    leadTimeDays: [30, 70],
  },
  ax3000: {
    name: "Wi-Fi 6 Router AX3000",
    category: "NETWORKING",
    price: [70, 160],
    cost: 0.7,
    quantities: MID,
    leadTimeDays: [30, 70],
  },
  mesh: {
    name: "Mesh Wi-Fi System 3-Pack",
    category: "NETWORKING",
    price: [90, 220],
    cost: 0.72,
    quantities: FEW,
    leadTimeDays: [30, 70],
  },
  sw8: {
    name: "Gigabit Switch 8-Port",
    category: "NETWORKING",
    price: [18, 48],
    cost: 0.65,
    quantities: MID,
    leadTimeDays: [30, 70],
  },
  sw24: {
    name: "Gigabit Switch 24-Port",
    category: "NETWORKING",
    price: [85, 210],
    cost: 0.7,
    quantities: FEW,
    leadTimeDays: [30, 70],
  },
  poe: {
    name: "PoE Switch 8-Port",
    category: "NETWORKING",
    price: [55, 130],
    cost: 0.68,
    quantities: FEW,
    leadTimeDays: [30, 70],
  },
  managed48: {
    name: "Managed Switch 48-Port",
    category: "NETWORKING",
    price: [450, 1_600],
    cost: 0.76,
    quantities: RARE,
    leadTimeDays: [45, 90],
  },
  ap: {
    name: "Wireless Access Point Wi-Fi 6",
    category: "NETWORKING",
    price: [85, 320],
    cost: 0.72,
    quantities: FEW,
    leadTimeDays: [30, 70],
  },
  lte: {
    name: "4G LTE Router",
    category: "NETWORKING",
    price: [50, 140],
    cost: 0.68,
    quantities: MID,
    leadTimeDays: [30, 70],
  },
  powerline: {
    name: "Powerline Adapter Kit",
    category: "NETWORKING",
    price: [30, 70],
    cost: 0.65,
    quantities: MID,
    leadTimeDays: [30, 70],
  },
  patch: {
    name: "Patch Cable Cat6 2 m",
    category: "NETWORKING",
    price: [2, 6],
    cost: 0.5,
    quantities: BULK,
    leadTimeDays: [30, 60],
  },
  usbwifi: {
    name: "USB Wi-Fi Adapter",
    category: "NETWORKING",
    price: [8, 24],
    cost: 0.6,
    quantities: BULK,
    leadTimeDays: [30, 60],
  },
  sfp: {
    name: "SFP+ Transceiver",
    category: "NETWORKING",
    price: [25, 60],
    cost: 0.6,
    quantities: MID,
    leadTimeDays: [30, 70],
  },
} as const satisfies Record<string, ProductClass>;

export type ProductClassKey = keyof typeof PRODUCT_CLASSES;

/** What a brand lists, as a class and how many items it has of it. */
type Mix = readonly (readonly [ProductClassKey, number])[];

const BRAND_MIX: Readonly<Record<string, Mix>> = {
  Dell: [
    ["nb14", 4],
    ["nb15", 3],
    ["desktop", 2],
    ["aio", 1],
    ["ws", 1],
    ["mon24", 3],
    ["mon27", 1],
    ["dock", 1],
    ["kb", 1],
    ["mouse", 1],
  ],
  HP: [
    ["nb14", 2],
    ["nb15", 3],
    ["desktop", 2],
    ["mini", 1],
    ["ws", 1],
    ["printer", 2],
    ["mon24", 1],
    ["kb", 1],
    ["mouse", 1],
    ["charger", 2],
  ],
  Lenovo: [
    ["nb14", 3],
    ["nb15", 2],
    ["desktop", 1],
    ["mini", 1],
    ["ws", 1],
    ["mon24", 2],
    ["dock", 1],
    ["headset", 1],
    ["webcam", 1],
    ["kb", 2],
  ],
  Acer: [
    ["nb14", 2],
    ["nb15", 2],
    ["desktop", 1],
    ["aio", 1],
    ["mon24", 1],
    ["mon27", 1],
    ["mouse", 1],
    ["kb", 1],
  ],
  Asus: [
    ["nb14", 2],
    ["nb15", 1],
    ["desktop", 1],
    ["mini", 1],
    ["mon24", 1],
    ["mon27", 1],
    ["webcam", 1],
    ["kb", 1],
    ["mouse", 1],
  ],
  Samsung: [
    ["mon24", 2],
    ["mon27", 3],
    ["mon32", 2],
    ["microsd", 2],
    ["portssd", 3],
    ["ssd", 2],
  ],
  Intel: [
    ["cpu", 7],
    ["srvcpu", 3],
    ["ssd", 2],
    ["nic", 1],
  ],
  Seagate: [
    ["hdd", 5],
    ["survhdd", 4],
    ["ssd", 3],
  ],
  Toshiba: [
    ["hdd", 5],
    ["survhdd", 2],
    ["ssd", 2],
    ["microsd", 1],
    ["usb", 2],
  ],
  Kioxia: [
    ["ssd", 6],
    ["microsd", 2],
    ["usb", 2],
    ["srvssd", 2],
  ],
  Lexar: [
    ["microsd", 4],
    ["usb", 5],
    ["ssd", 2],
    ["portssd", 2],
  ],
  Verbatim: [
    ["usb", 5],
    ["dvd", 3],
    ["microsd", 2],
    ["ssd", 1],
  ],
  TeamGroup: [
    ["ddr5", 6],
    ["ssd", 3],
    ["usb", 2],
    ["microsd", 1],
  ],
  "Cooler Master": [
    ["cooler", 4],
    ["case", 4],
    ["psu", 3],
    ["mouse", 1],
  ],
  Hikvision: [
    ["dome", 5],
    ["bullet", 5],
    ["ptz", 2],
    ["nvr8", 3],
    ["nvr32", 1],
    ["access", 2],
    ["intercom", 1],
    ["adapter", 1],
  ],
  Honeywell: [
    ["alarm", 3],
    ["sensor", 3],
    ["motion", 3],
    ["access", 2],
    ["dome", 1],
    ["nvr8", 1],
  ],
  "TP-Link": [
    ["ax1800", 3],
    ["ax3000", 2],
    ["mesh", 1],
    ["sw8", 3],
    ["sw24", 2],
    ["poe", 2],
    ["ap", 2],
    ["lte", 1],
    ["powerline", 1],
    ["patch", 1],
    ["usbwifi", 1],
  ],
  Cudy: [
    ["ax1800", 3],
    ["ax3000", 2],
    ["lte", 2],
    ["mesh", 1],
    ["sw8", 2],
    ["usbwifi", 1],
    ["ap", 1],
    ["powerline", 1],
  ],
  Aruba: [
    ["managed48", 3],
    ["sw24", 2],
    ["ap", 5],
    ["poe", 2],
    ["sfp", 3],
  ],
  HPE: [
    ["rack1u", 2],
    ["rack2u", 2],
    ["tower", 1],
    ["srvmem", 3],
    ["srvssd", 2],
    ["nic", 2],
    ["rail", 2],
  ],
  Supermicro: [
    ["rack1u", 2],
    ["rack2u", 2],
    ["srvmb", 3],
    ["srvmem", 2],
    ["srvssd", 2],
    ["nic", 1],
    ["rail", 1],
  ],
  Vertiv: [
    ["ups1500", 4],
    ["ups3k", 2],
    ["pdu", 4],
    ["rack42", 2],
    ["rail", 1],
  ],
};

/**
 * A part number in the brand's own style. Every one carries `ZZ` and the item's
 * running number, which is what makes it made-up and unique.
 */
export const PART_NUMBER_STYLES: Readonly<
  Record<string, (running: string) => string>
> = {
  Dell: (n) => `210-ZZ${n}`,
  HP: (n) => `9ZZ${n}AA`,
  Lenovo: (n) => `4XZZ${n}`,
  Acer: (n) => `UM.ZZ${n}.001`,
  Asus: (n) => `90ZZ${n}-M01`,
  Samsung: (n) => `LSZZ${n}EAUXXE`,
  Intel: (n) => `BX80ZZ${n}`,
  Seagate: (n) => `STZZ${n}NM000A`,
  Toshiba: (n) => `HDWZZ${n}EZSTA`,
  Kioxia: (n) => `KBZZ${n}G`,
  Lexar: (n) => `LXZZ${n}-BNNNG`,
  Verbatim: (n) => `VB-ZZ${n}`,
  TeamGroup: (n) => `TFZZ${n}-D1`,
  "Cooler Master": (n) => `MCZZ-${n}-KKN1`,
  Hikvision: (n) => `DS-2CDZZ${n}-I`,
  Honeywell: (n) => `HCZZ${n}W`,
  "TP-Link": (n) => `TL-ZZ${n}`,
  Cudy: (n) => `CUZZ${n}`,
  Aruba: (n) => `JLZZ${n}A`,
  HPE: (n) => `PZZ${n}-B21`,
  Supermicro: (n) => `SYS-ZZ${n}-TR`,
  Vertiv: (n) => `GXTZZ${n}RT2U`,
};

export interface ItemPlan {
  readonly brand: BrandSpec;
  readonly classKey: ProductClassKey;
  readonly productClass: ProductClass;
  /** The words after the brand in the description, such as `Notebook 14-inch Pro`. */
  readonly label: string;
  /** The item that C9's short-stock case uses: a cheap, normal-stock flash drive. */
  readonly plantedShort?: true;
}

/**
 * A low-stock item must be cheap enough that a stock purchase request for it stays
 * inside the approver's limit of 5,000.00 and can still ask for at least ten.
 */
const LOW_STOCK_COST_LIMIT = 490;

const SUFFIXES = [
  "",
  " Pro",
  " Lite",
  " Plus",
  " Max",
  " Gen 2",
  " Gen 3",
  " Elite",
  " Value",
  " Core",
] as const;

/**
 * Every sixth item is kept low on purpose: an order for a lot of one of them
 * is short, so the stock purchase requests have something to follow from.
 * Ordinary order lines never use them.
 */
export function isLowStockIndex(itemIndex: number): boolean {
  return itemIndex % 6 === 3;
}

function affordable(key: ProductClassKey): boolean {
  const c: ProductClass = PRODUCT_CLASSES[key];
  return c.price[1] * c.cost < LOW_STOCK_COST_LIMIT;
}

/** The brand's items in turn across its classes, so no class bunches up. */
function rotate(mix: Mix): ProductClassKey[] {
  const left = mix.map(([key, count]) => ({ key, count }));
  const keys: ProductClassKey[] = [];
  while (left.some((entry) => entry.count > 0)) {
    for (const entry of left) {
      if (entry.count > 0) {
        keys.push(entry.key);
        entry.count -= 1;
      }
    }
  }
  return keys;
}

let planned: readonly ItemPlan[] | undefined;

/**
 * The 300 items, in item-number order: which brand, which class, which words.
 * A low-stock index takes the brand's next cheap class when its own is dear.
 */
export function planCatalogue(): readonly ItemPlan[] {
  if (planned) return planned;
  const plan: ItemPlan[] = [];
  let plantedShortUsed = false;
  for (const brand of BRANDS) {
    const mix = BRAND_MIX[brand.name];
    if (!mix) throw new Error(`No product mix for ${brand.name}`);
    const keys = rotate(mix);
    const cheap = keys.filter(affordable);
    if (cheap.length === 0) throw new Error(`${brand.name} has nothing cheap`);
    const seen = new Map<ProductClassKey, number>();
    let cheapTurn = 0;
    for (const wanted of keys) {
      const index = plan.length;
      let classKey = wanted;
      if (isLowStockIndex(index) && !affordable(classKey)) {
        classKey = cheap[cheapTurn++ % cheap.length] ?? classKey;
      }
      const occurrence = seen.get(classKey) ?? 0;
      seen.set(classKey, occurrence + 1);
      const productClass: ProductClass = PRODUCT_CLASSES[classKey];
      const isPlanted =
        !plantedShortUsed &&
        brand.name === "Lexar" &&
        classKey === "usb" &&
        !isLowStockIndex(index);
      if (isPlanted) plantedShortUsed = true;
      plan.push({
        brand,
        classKey,
        productClass,
        label: `${productClass.name}${SUFFIXES[occurrence % SUFFIXES.length] ?? ""}`,
        ...(isPlanted ? { plantedShort: true as const } : {}),
      });
    }
  }
  planned = plan;
  return plan;
}
