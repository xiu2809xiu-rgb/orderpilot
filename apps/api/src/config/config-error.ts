/** The environment is missing something or holds a bad value. Safe to print: it never holds a value. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}
