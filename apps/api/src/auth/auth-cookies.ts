import { Inject, Injectable } from "@nestjs/common";
import {
  COOKIES,
  REFRESH_COOKIE_PATH,
  TWO_STEP_COOKIE_PATH,
} from "@orderpilot/shared";
import type { CookieOptions, Request, Response } from "express";
import { AppConfig } from "../config/app-config.js";

/** The three credentials of one sign-in, ready to be put in cookies. */
export interface IssuedCookies {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly csrfToken: string;
}

/** Reads one cookie from the Cookie header. Nothing else in the API parses cookies. */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 1 || part.slice(0, index).trim() !== name) continue;
    const raw = part.slice(index + 1).trim();
    try {
      return raw === "" ? undefined : decodeURIComponent(raw);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Sets and clears the session cookies.
 *
 * - op_access: the JWT. httpOnly, so a script cannot read it.
 * - op_refresh: httpOnly, and sent only to the auth path.
 * - op_csrf: readable by script on purpose, so the web app can copy it into
 *   the X-CSRF-Token header. It lasts as long as the refresh token, which also
 *   tells the web app after a reload that a session may be open.
 *
 * - op_two_step: the sign-in challenge between the password and the second
 *   step. httpOnly, five minutes, and its Path is exactly the verify route, so
 *   no other route ever receives it.
 *
 * All of them are SameSite=Strict (the web app and the API share a site behind
 * the proxy) and Secure, except on a laptop with COOKIE_SECURE=false, which
 * only APP_ENV=local may choose.
 */
@Injectable()
export class AuthCookies {
  constructor(@Inject(AppConfig) private readonly config: AppConfig) {}

  set(res: Response, cookies: IssuedCookies): void {
    const { accessTokenTtlSeconds, refreshTokenTtlSeconds } = this.config.auth;
    res.cookie(COOKIES.access, cookies.accessToken, {
      ...this.base("/"),
      httpOnly: true,
      maxAge: accessTokenTtlSeconds * 1000,
    });
    res.cookie(COOKIES.refresh, cookies.refreshToken, {
      ...this.base(REFRESH_COOKIE_PATH),
      httpOnly: true,
      maxAge: refreshTokenTtlSeconds * 1000,
    });
    res.cookie(COOKIES.csrf, cookies.csrfToken, {
      ...this.base("/"),
      httpOnly: false,
      maxAge: refreshTokenTtlSeconds * 1000,
    });
  }

  /** The challenge of a password sign-in that waits for its second step. */
  setChallenge(res: Response, token: string, ttlSeconds: number): void {
    res.cookie(COOKIES.twoStep, token, {
      ...this.base(TWO_STEP_COOKIE_PATH),
      httpOnly: true,
      maxAge: ttlSeconds * 1000,
    });
  }

  clearChallenge(res: Response): void {
    res.clearCookie(COOKIES.twoStep, {
      ...this.base(TWO_STEP_COOKIE_PATH),
      httpOnly: true,
    });
  }

  /** The Path and flags must match the ones that set a cookie, or the browser keeps it. */
  clear(res: Response): void {
    res.clearCookie(COOKIES.access, { ...this.base("/"), httpOnly: true });
    res.clearCookie(COOKIES.refresh, {
      ...this.base(REFRESH_COOKIE_PATH),
      httpOnly: true,
    });
    res.clearCookie(COOKIES.csrf, { ...this.base("/"), httpOnly: false });
    this.clearChallenge(res);
  }

  private base(path: string): CookieOptions {
    return {
      path,
      secure: this.config.auth.cookieSecure,
      sameSite: "strict",
    };
  }
}
