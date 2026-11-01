import { Navigate, useLocation } from "react-router";

/** /master-data opens Items, keeping any filter a link carried. */
export default function MasterDataPage() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: "/master-data/items", search }} replace />;
}
