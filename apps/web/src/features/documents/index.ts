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
  cues: [
    { id: "toConfirm", roles: ["SUPPORT"] },
    { id: "received", roles: ["SUPPORT", "LOGISTICS"] },
  ],
  Page: lazy(() => import("./DocumentsPage")),
});
