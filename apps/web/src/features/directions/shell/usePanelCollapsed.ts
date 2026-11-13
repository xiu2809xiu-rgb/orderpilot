import { useCallback, useState } from "react";

const KEY = "op-dx-panel-collapsed";

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Whether the panel is the 64 px rail. Remembered in this browser only, as a convenience. */
export function usePanelCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(read);
  const toggle = useCallback(() => {
    setCollapsed((was) => {
      try {
        window.localStorage.setItem(KEY, was ? "0" : "1");
      } catch {
        // The choice then lasts until the page is closed.
      }
      return !was;
    });
  }, []);
  return [collapsed, toggle];
}
