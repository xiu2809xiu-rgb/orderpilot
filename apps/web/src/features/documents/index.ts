import { FileText } from "lucide-react";
import { defineFeature, devOnlyPage } from "../define";

export default defineFeature({
  id: "documents",
  namespace: "documents",
  path: "documents",
  permission: "documents.read",
  menu: [
    {
      id: "documents.inbox",
      module: "documents",
      label: "documents:menu.inbox",
      to: "/documents",
      icon: FileText,
    },
  ],
  cues: [],
  planned: true,
  Page: devOnlyPage(
    import.meta.env.DEV ? () => import("./DocumentsPage") : undefined,
  ),
});
