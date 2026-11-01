import { FileText } from "lucide-react";
import { lazy } from "react";
import { defineFeature } from "../define";

export default defineFeature({
  id: "documents",
  namespace: "documents",
  path: "documents",
  group: "operations",
  icon: FileText,
  permission: "documents.read",
  cues: [],
  Page: lazy(() => import("./DocumentsPage")),
});
