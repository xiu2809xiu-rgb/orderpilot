import { useEffect } from "react";
import { useSparkPanel } from "../../shell/sparkPanel";
import HomeScreen from "../home/HomeScreen";

/**
 * The Spark view of the preview: Spark is a panel, not a page, so this opens
 * the panel over the home screen, which is what a person sees when they ask
 * Spark something while working. Closing the panel leaves home as it is.
 */
export default function SparkScreen() {
  const { setOpen } = useSparkPanel();
  useEffect(() => {
    setOpen(true);
  }, [setOpen]);
  return <HomeScreen />;
}
