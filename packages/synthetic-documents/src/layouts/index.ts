import type { LegacyLayout } from "../model.js";
import { drawBoxed } from "./boxed.js";
import { drawBranded } from "./branded.js";
import { drawHouse } from "./house.js";
import type { DrawLayout } from "./kit.js";
import { drawLetter } from "./letter.js";
import { drawTableLayout } from "./table.js";

export const LAYOUTS: Readonly<Record<LegacyLayout, DrawLayout>> = {
  boxed: drawBoxed,
  letter: drawLetter,
  table: drawTableLayout,
  branded: drawBranded,
  house: drawHouse,
};
