import { useState } from "react";
import {
  usePoVersionsDiff,
  usePoVersionsList,
} from "@/lib/api/generated/endpoints/orders/orders";
import {
  defaultPair,
  movePair,
  pairFits,
  type VersionPair,
} from "./versionsModel";

/**
 * What the Versions tab reads: the list of PO versions, the pair a person
 * compares and the differences between them. The differences are asked for only
 * when there are two versions to compare, and the pair is the previous and the
 * current one until a person chooses another.
 */
export function usePoVersions(orderNo: string) {
  const list = usePoVersionsList(orderNo);
  const current = list.data?.data.currentPoVersionNo ?? 1;
  const [chosen, setChosen] = useState<VersionPair | null>(null);
  // A pair chosen before a newer version arrived still fits; one that no
  // longer does falls back to the default.
  const pair =
    chosen && pairFits(chosen, current) ? chosen : defaultPair(current);
  const diff = usePoVersionsDiff(orderNo, pair, {
    query: { enabled: current >= 2 },
  });
  return {
    list,
    current,
    pair,
    choose: (choice: Partial<VersionPair>) => {
      setChosen(movePair(pair, choice, current));
    },
    diff,
  };
}
