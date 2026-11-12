export {
  DEMO_FILES,
  DEMO_REFERENCE_DATE,
  pickDemoFiles,
  renderDemoFile,
  renderEntry,
} from "./demo.js";
export type { DemoFile } from "./demo.js";
export { groundTruth } from "./truth.js";
export type {
  ExpectedValue,
  GroundTruth,
  PlantedMistake,
  TruthField,
  TruthLine,
} from "./truth.js";
export { asEntry } from "./plan/entry.js";
export type { ExpectedFrom, PlanEntry } from "./plan/entry.js";
export { twelvePlan } from "./plan/twelve.js";
export { definitionOf } from "./registry.js";
export type { AnyDefinition, DocumentDefinition } from "./definition.js";
export { contextFor } from "./context.js";
export type { RenderContext } from "./context.js";
export { resolve } from "./subject.js";
export type { Subject, SubjectRef } from "./subject.js";
export { generateDemoFiles } from "./files.js";
export type { GeneratedFile } from "./files.js";
export { layoutForCustomer } from "./facts-data.js";
export type { DocumentFacts } from "./facts.js";
export type { BaseFacts, PlantedRecord } from "./facts-base.js";
export {
  DEMO_LABEL,
  DOCUMENT_KINDS,
  MISTAKE_KINDS,
  PO_LAYOUTS,
  fieldId,
} from "./model.js";
export type {
  BoxFractions,
  Direction,
  DocumentKind,
  Issuer,
  LayoutId,
  MistakeKind,
  PlacedField,
  PoLayout,
  Stage,
} from "./model.js";
export { renderDocument, renderResolved, renderSubject } from "./render.js";
export type { RenderOptions, RenderedDocument } from "./render.js";
