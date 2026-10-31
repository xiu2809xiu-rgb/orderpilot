import { Orbit } from "lucide-react";
import { lazy } from "react";
import { defineFeature } from "../define";

export default defineFeature({
  id: "constellation",
  namespace: "constellation",
  path: "constellation",
  group: "insight",
  icon: Orbit,
  permission: "orders.read",
  cues: [],
  Page: lazy(() => import("./ConstellationPage")),
});
