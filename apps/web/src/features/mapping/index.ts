import { ArrowLeftRight } from "lucide-react";
import { defineFeature, devOnlyPage } from "../define";

export default defineFeature({
  id: "mapping",
  namespace: "mapping",
  path: "mapping",
  permission: "settings.manage",
  menu: [
    {
      id: "mapping.mapping",
      module: "system",
      label: "mapping:menu.mapping",
      to: "/mapping",
      icon: ArrowLeftRight,
    },
  ],
  cues: [],
  planned: true,
  Page: devOnlyPage(
    import.meta.env.DEV ? () => import("./MappingPage") : undefined,
  ),
});
