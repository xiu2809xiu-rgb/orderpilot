import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface CrumbTail {
  tail: string | undefined;
  setTail: (tail: string | undefined) => void;
}

const CrumbContext = createContext<CrumbTail>({
  tail: undefined,
  setTail: () => undefined,
});

/** Holds the last crumb a screen adds, such as an order's number. */
export function CrumbProvider({ children }: { children: ReactNode }) {
  const [tail, setTail] = useState<string | undefined>();
  const value = useMemo(() => ({ tail, setTail }), [tail]);
  return <CrumbContext value={value}>{children}</CrumbContext>;
}

export function useCrumbTail(): string | undefined {
  return useContext(CrumbContext).tail;
}

/** A screen calls this with a record's number and the trail ends with it. */
export function usePageCrumb(label: string | undefined): void {
  const { setTail } = useContext(CrumbContext);
  useEffect(() => {
    setTail(label);
    return () => {
      setTail(undefined);
    };
  }, [label, setTail]);
}
