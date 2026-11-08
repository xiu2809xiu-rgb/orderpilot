// The document form: the page every order, SPR, payment confirmation and
// shipment is edited on. CONTRIBUTING.md, "Building a document form", shows a
// screen declaring one.
export { DocumentForm, type DocumentFormProps } from "./DocumentForm";
export { registerDocumentFormItem, type DocumentFormItem } from "./registry";
export {
  DOCUMENT_ACTION_KINDS,
  type AttachmentItem,
  type DocumentAction,
  type DocumentActionKind,
  type DocumentPrint,
  type DocumentReasoned,
  type DocumentRecordState,
  type DocumentStatus,
  type DocumentTabSpec,
  type DocumentTabsSpec,
  type DocumentTarget,
  type FooterFigure,
} from "./types";
