import { Plug } from "lucide-react";
import { defineFeature, devOnlyPage } from "../define";

export default defineFeature({
  id: "connectors",
  namespace: "connectors",
  path: "connectors",
  permission: "settings.manage",
  menu: [
    {
      id: "connectors.connectors",
      module: "system",
      label: "connectors:menu.connectors",
      to: "/connectors",
      icon: Plug,
    },
  ],
  cues: [],
  planned: true,
  Page: devOnlyPage(
    import.meta.env.DEV ? () => import("./ConnectorsPage") : undefined,
  ),
});
