import { Database } from "lucide-react";
import { lazy } from "react";
import { defineFeature } from "../define";

export default defineFeature({
  id: "master-data",
  namespace: "master-data",
  path: "master-data",
  group: "data",
  icon: Database,
  permission: "orders.read",
  cues: [],
  Page: lazy(() => import("./MasterDataPage")),
});
