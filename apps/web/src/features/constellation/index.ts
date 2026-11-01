import { Orbit } from "lucide-react";
import { defineFeature, devOnlyPage } from "../define";

export default defineFeature({
  id: "constellation",
  namespace: "constellation",
  path: "constellation",
  permission: "orders.read",
  menu: [
    {
      id: "constellation.constellation",
      module: "reports",
      label: "constellation:menu.constellation",
      to: "/constellation",
      icon: Orbit,
    },
  ],
  cues: [],
  planned: true,
  Page: devOnlyPage(
    import.meta.env.DEV ? () => import("./ConstellationPage") : undefined,
  ),
});
