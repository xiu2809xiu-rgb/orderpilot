// Types for index.js, for any eslint.config.ts that imports this package.
import type { Linter } from "eslint";

export declare const TS_FILES: string[];
export declare const JS_FILES: string[];
export declare const JSX_FILES: string[];

export declare function warningsAsErrors(config: Linter.Config): Linter.Config;

export declare function orderpilot(options: {
  tsconfigRootDir: string;
}): Linter.Config[];

export default orderpilot;
