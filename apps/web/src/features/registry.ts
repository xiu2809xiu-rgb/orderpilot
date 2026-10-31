// Every feature the shell knows about, in sidebar order. An area adds its
// feature here and nowhere else in the app shell. Names follow
// docs/team/module-ownership.md.
import type { Feature } from "./define";
import workflows from "./workflows";
import documents from "./documents";
import orders from "./orders";
import orderTracker from "./order-tracker";
import exceptions from "./exceptions";
import masterData from "./master-data";
import mapping from "./mapping";
import connectors from "./connectors";
import insights from "./insights";
import constellation from "./constellation";
import governance from "./governance";
import audit from "./audit";
import monitoring from "./monitoring";

export const features: readonly Feature[] = [
  workflows,
  documents,
  orders,
  orderTracker,
  exceptions,
  masterData,
  mapping,
  connectors,
  insights,
  constellation,
  governance,
  audit,
  monitoring,
];
