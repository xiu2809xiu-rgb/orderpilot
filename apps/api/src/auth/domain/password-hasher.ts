import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id with the OWASP minimum cost (19 MiB, 2 passes, 1 lane). The library
 * defaults to argon2id; a test checks the prefix so a change cannot slip by.
 */
const COST = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export class PasswordHasher {
  /** A hash that no password matches, checked when the account is unknown. */
  private dummy: Promise<string> | null = null;

  hash(password: string): Promise<string> {
    return hash(password, COST);
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password).catch(() => false);
  }

  /**
   * Checks a password against the account's hash, or against a dummy when
   * there is no such account or it has no password, so an unknown user and a
   * wrong password take about the same time and give the same answer.
   */
  async check(passwordHash: string | null, password: string): Promise<boolean> {
    if (passwordHash === null) {
      this.dummy ??= this.hash("not-a-password-anyone-has");
      await this.verify(await this.dummy, password);
      return false;
    }
    return this.verify(passwordHash, password);
  }
}
