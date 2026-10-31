import { ArrowLeftRight } from "lucide-react";
import { lazy } from "react";
import { defineFeature } from "../define";

export default defineFeature({
  id: "mapping",
  namespace: "mapping",
  path: "mapping",
  group: "data",
  icon: ArrowLeftRight,
  permission: "settings.manage",
  cues: [],
  Page: lazy(() => import("./MappingPage")),
});
