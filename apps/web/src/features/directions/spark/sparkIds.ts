/**
 * The ids the top bar's Spark button and the panel point at each other with:
 * the button names the panel it controls, and focus goes back to the button
 * when the panel closes. A file of its own so the bar can import them without
 * pulling in the panel's chunk.
 */
export const SPARK_BUTTON_ID = "spark-button";
export const SPARK_PANEL_ID = "spark-panel";
export const SPARK_INPUT_ID = "spark-input";
