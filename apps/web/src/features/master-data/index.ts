import { Building2, Database, Factory, Search } from "lucide-react";
import { lazy } from "react";
import { registerAction } from "@/lib/actions";
import { defineFeature } from "../define";
import { masterDataRoutes } from "./routes";

const action = (
  id: string,
  icon: typeof Search,
  path: string,
  keywords: readonly string[],
) =>
  registerAction({
    id: `master-data.${id}`,
    label: `actions.${id}`,
    namespace: "master-data",
    icon,
    keywords,
    permission: "orders.read",
    run: ({ navigate }) => {
      navigate(path);
    },
  });

action("findItem", Search, "/master-data/items", ["stock", "part number"]);
action("customers", Building2, "/master-data/customers", ["credit", "account"]);
action("vendors", Factory, "/master-data/vendors", ["supplier", "bank"]);

export default defineFeature({
  id: "master-data",
  namespace: "master-data",
  path: "master-data",
  group: "data",
  icon: Database,
  permission: "orders.read",
  cues: [],
  Page: lazy(() => import("./MasterDataPage")),
  children: masterDataRoutes,
});
