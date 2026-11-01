export {
  DEMO_FILES,
  DEMO_REFERENCE_DATE,
  groundTruth,
  renderDemoFile,
} from "./demo.js";
export type { DemoFile, GroundTruth } from "./demo.js";
export { generateDemoFiles } from "./files.js";
export type { GeneratedFile } from "./files.js";
export { layoutForCustomer } from "./facts-data.js";
export type { DocumentFacts } from "./facts.js";
export { DEMO_LABEL, DOCUMENT_KINDS, PO_LAYOUTS, fieldId } from "./model.js";
export type {
  BoxFractions,
  DocumentKind,
  LayoutId,
  PlacedField,
  PoLayout,
} from "./model.js";
export { renderDocument } from "./render.js";
export type { RenderOptions, RenderedDocument } from "./render.js";
