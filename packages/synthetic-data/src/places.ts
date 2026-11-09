import type { CountryCode } from "./types.js";

// Cities are real, because a distributor's customers are in real places. The
// streets, building numbers, postal codes and tax numbers are made up, and the
// tax numbers are obviously fake: the country code, the letters ZZ, a run of
// zeros and the customer's running number.

export const COUNTRY_NAMES: Readonly<Record<CountryCode, string>> = {
  AE: "United Arab Emirates",
  PK: "Pakistan",
  LK: "Sri Lanka",
  MV: "Maldives",
  IN: "India",
  NP: "Nepal",
  BD: "Bangladesh",
  VN: "Vietnam",
  SG: "Singapore",
  ID: "Indonesia",
  MY: "Malaysia",
};

interface City {
  readonly name: string;
  /** The state, province, emirate or atoll the city is in. */
  readonly state: string;
  /** The first digits of the postal code, when the country gives them by area. */
  readonly area: string;
}

interface Place {
  readonly cities: readonly City[];
  readonly streets: readonly string[];
  /** Digits in a postal code. */
  readonly postalDigits: number;
  /** Text before the code: the UAE has no postal codes, only P.O. boxes. */
  readonly postalPrefix?: string;
  /** Characters in a tax registration number. */
  readonly taxLength: number;
}

const PLACES: Readonly<Record<CountryCode, Place>> = {
  AE: {
    cities: [
      { name: "Dubai", state: "Dubai", area: "" },
      { name: "Sharjah", state: "Sharjah", area: "" },
      { name: "Abu Dhabi", state: "Abu Dhabi", area: "" },
      { name: "Ajman", state: "Ajman", area: "" },
    ],
    streets: [
      "Marjaan Street",
      "Qasrel Road",
      "Dunefall Avenue",
      "Salmara Street",
    ],
    postalDigits: 5,
    postalPrefix: "P.O. Box ",
    taxLength: 15,
  },
  PK: {
    cities: [
      { name: "Karachi", state: "Sindh", area: "74" },
      { name: "Lahore", state: "Punjab", area: "54" },
      { name: "Islamabad", state: "Islamabad Capital Territory", area: "44" },
      { name: "Faisalabad", state: "Punjab", area: "38" },
    ],
    streets: [
      "Chenavar Road",
      "Karakel Street",
      "Multara Boulevard",
      "Sulemar Lane",
    ],
    postalDigits: 5,
    taxLength: 13,
  },
  LK: {
    cities: [
      { name: "Colombo", state: "Western Province", area: "00" },
      { name: "Kandy", state: "Central Province", area: "20" },
      { name: "Galle", state: "Southern Province", area: "80" },
      { name: "Negombo", state: "Western Province", area: "11" },
    ],
    streets: [
      "Selvaran Mawatha",
      "Kandaleya Road",
      "Sirimal Place",
      "Nuwaran Lane",
    ],
    postalDigits: 5,
    taxLength: 12,
  },
  MV: {
    cities: [
      { name: "Male", state: "Kaafu Atoll", area: "20" },
      { name: "Hulhumale", state: "Kaafu Atoll", area: "20" },
      { name: "Addu City", state: "Addu Atoll", area: "19" },
    ],
    streets: [
      "Veyrulhu Magu",
      "Maldura Goalhi",
      "Hithadhu Magu",
      "Kuredhu Road",
    ],
    postalDigits: 5,
    taxLength: 11,
  },
  IN: {
    cities: [
      { name: "Mumbai", state: "Maharashtra", area: "400" },
      { name: "Chennai", state: "Tamil Nadu", area: "600" },
      { name: "Bengaluru", state: "Karnataka", area: "560" },
      { name: "Delhi", state: "Delhi", area: "110" },
    ],
    streets: [
      "Quillon Harbour Road",
      "Dhanvera Marg",
      "Marundel Street",
      "Tejoran Cross Road",
    ],
    postalDigits: 6,
    taxLength: 15,
  },
  NP: {
    cities: [
      { name: "Kathmandu", state: "Bagmati Province", area: "446" },
      { name: "Lalitpur", state: "Bagmati Province", area: "447" },
      { name: "Pokhara", state: "Gandaki Province", area: "337" },
    ],
    streets: [
      "Himvanta Marg",
      "Sagarun Path",
      "Pashukal Chowk Road",
      "Kathara Sadak",
    ],
    postalDigits: 5,
    taxLength: 10,
  },
  BD: {
    cities: [
      { name: "Dhaka", state: "Dhaka Division", area: "12" },
      { name: "Chattogram", state: "Chattogram Division", area: "41" },
      { name: "Khulna", state: "Khulna Division", area: "90" },
    ],
    streets: [
      "Tamarell Road",
      "Jamunia Avenue",
      "Meghora Street",
      "Banirupa Lane",
    ],
    postalDigits: 4,
    taxLength: 13,
  },
  VN: {
    cities: [
      { name: "Ho Chi Minh City", state: "Ho Chi Minh City", area: "70" },
      { name: "Hanoi", state: "Hanoi", area: "10" },
      { name: "Da Nang", state: "Da Nang", area: "55" },
    ],
    streets: [
      "Mekonvi Street",
      "Hoanvi Road",
      "Thanhlor Boulevard",
      "Dalvien Lane",
    ],
    postalDigits: 6,
    taxLength: 10,
  },
  SG: {
    cities: [{ name: "Singapore", state: "Singapore", area: "" }],
    streets: [
      "Tanjora Road",
      "Orchardel Avenue",
      "Selarang Way",
      "Bedokan Street",
    ],
    postalDigits: 6,
    taxLength: 10,
  },
  ID: {
    cities: [
      { name: "Jakarta", state: "DKI Jakarta", area: "10" },
      { name: "Surabaya", state: "East Java", area: "60" },
      { name: "Bandung", state: "West Java", area: "40" },
      { name: "Medan", state: "North Sumatra", area: "20" },
    ],
    streets: [
      "Cendrawan Street",
      "Nusavara Road",
      "Jakaran Boulevard",
      "Merpati Lane",
    ],
    postalDigits: 5,
    taxLength: 16,
  },
  MY: {
    cities: [
      { name: "Kuala Lumpur", state: "Wilayah Persekutuan", area: "50" },
      { name: "George Town", state: "Penang", area: "10" },
      { name: "Johor Bahru", state: "Johor", area: "80" },
      { name: "Petaling Jaya", state: "Selangor", area: "47" },
    ],
    streets: [
      "Selvora Road",
      "Petalon Avenue",
      "Kenanga Mur Street",
      "Johorin Lane",
    ],
    postalDigits: 5,
    taxLength: 12,
  },
};

const pad = (n: number, width: number): string =>
  String(n).padStart(width, "0");

export interface Address {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
}

/**
 * A made-up address in a real city, the same for the same customer number.
 * Pure, so adding customers never moves anyone else's address.
 */
export function addressOf(n: number, country: CountryCode): Address {
  const place = PLACES[country];
  const city = place.cities[n % place.cities.length];
  const street = place.streets[(n * 7) % place.streets.length];
  if (!city || !street) throw new Error(`No place for ${country}`);
  const tail = pad((n * 37) % 1000, place.postalDigits - city.area.length);
  return {
    addressLine1: `${String(1 + ((n * 13) % 98))} ${street}`,
    addressLine2: `Unit ${String(1 + (n % 12))}${"ABC"[n % 3] ?? "A"}`,
    city: city.name,
    state: city.state,
    postalCode: `${place.postalPrefix ?? ""}${city.area}${tail}`.slice(
      0,
      (place.postalPrefix?.length ?? 0) + place.postalDigits,
    ),
  };
}

/**
 * An obviously fake tax registration number: the country code, ZZ, a run of
 * zeros and the customer number, at the length that country's numbers have.
 */
export function taxIdOf(n: number, country: CountryCode): string {
  const { taxLength } = PLACES[country];
  const head = `${country}ZZ`;
  const tail = pad(n, 4);
  return `${head}${"0".repeat(taxLength - head.length - tail.length)}${tail}`;
}

/** How many characters a tax registration number has in that country. */
export function taxIdLength(country: CountryCode): number {
  return PLACES[country].taxLength;
}
