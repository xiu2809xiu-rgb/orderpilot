import type { LoggerService } from "@nestjs/common";
import type { Logger as PinoLogger } from "pino";
import { currentLogger } from "./logger.config.js";

type Level = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

/**
 * Nest's logger, writing JSON through pino. Everything Nest or the app logs
 * (`new Logger(Name)`) comes here, carrying the request id when it is written
 * while a request is being handled.
 *
 * Nest passes the context (the class name) as the last argument. A log call
 * can be `log("text")` or `log({ some: "fields" }, "text")`.
 */
export class AppLogger implements LoggerService {
  constructor(private readonly root: PinoLogger) {}

  log(message: unknown, ...rest: unknown[]): void {
    this.write("info", message, rest);
  }
  error(message: unknown, ...rest: unknown[]): void {
    this.write("error", message, rest);
  }
  warn(message: unknown, ...rest: unknown[]): void {
    this.write("warn", message, rest);
  }
  debug(message: unknown, ...rest: unknown[]): void {
    this.write("debug", message, rest);
  }
  verbose(message: unknown, ...rest: unknown[]): void {
    this.write("trace", message, rest);
  }
  fatal(message: unknown, ...rest: unknown[]): void {
    this.write("fatal", message, rest);
  }

  private write(level: Level, message: unknown, rest: unknown[]): void {
    const logger = currentLogger(this.root);
    const strings = rest.filter(
      (item): item is string => typeof item === "string",
    );
    const context =
      strings.length > 0 ? strings[strings.length - 1] : undefined;
    const bound = context === undefined ? logger : logger.child({ context });
    if (typeof message === "object" && message !== null) {
      // Fields first, then the text: log({ check: "db" }, "Check failed").
      const text = strings.length > 1 ? strings[0] : undefined;
      bound[level](message, text);
      return;
    }
    // A stack trace, if Nest passed one, is the middle string of error().
    const stack =
      level === "error" && strings.length > 2 ? strings[1] : undefined;
    const text =
      typeof message === "string" ? message : JSON.stringify(message);
    if (stack === undefined) bound[level](text);
    else bound[level]({ stack }, text);
  }
}
