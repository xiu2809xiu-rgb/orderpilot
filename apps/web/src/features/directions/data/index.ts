import history from "./history.json";
import stepTimes from "./step-times.json";
import stockAnswer from "./stock-answer.json";
import type { History, StepTimes, StockAnswer } from "./types";

// The three files the data script writes. They are typed here once, so a
// change to the script's shape fails the build, not a screen at run time.
export const STEP_TIMES: StepTimes = stepTimes;
export const SALES_HISTORY: History = history;
export const STOCK_ANSWER: StockAnswer = stockAnswer;
