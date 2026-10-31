import { Plug } from "lucide-react";
import { lazy } from "react";
import { defineFeature } from "../define";

export default defineFeature({
  id: "connectors",
  namespace: "connectors",
  path: "connectors",
  group: "data",
  icon: Plug,
  permission: "settings.manage",
  cues: [{ id: "health", roles: ["SYSTEM_ADMIN"] }],
  Page: lazy(() => import("./ConnectorsPage")),
});
