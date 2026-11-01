import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { securityHeaders } from "../security-headers";
import { renderNginx } from "./render-nginx.mjs";

const headers = securityHeaders();

function location(conf, name) {
  const start = conf.indexOf(`location ${name} {`);
  expect(start, name).toBeGreaterThan(-1);
  return conf.slice(start, conf.indexOf("\n    }", start));
}

describe("the web image's nginx configuration", () => {
  const { serverConf, headersConf } = renderNginx({ headers });

  it("writes every security header, always", () => {
    for (const [name, value] of Object.entries(headers)) {
      expect(headersConf).toContain(`add_header ${name} "${value}" always;`);
    }
  });

  it("repeats the headers in each static location, because nginx does not inherit them", () => {
    for (const name of ["/assets/", "= /index.html", "/"]) {
      expect(location(serverConf, name)).toContain(
        "include /etc/nginx/security-headers.conf;",
      );
    }
  });

  it("adds nothing to a proxied API answer: a second policy would combine with the API's", () => {
    const api = location(serverConf, "/api/");
    expect(api).not.toContain("add_header");
    expect(api).not.toContain("security-headers.conf");
    expect(api).toContain("proxy_pass http://$api_upstream;");
  });

  it("falls back to the app for a deep link, and never for a hashed file", () => {
    expect(location(serverConf, "/")).toContain("try_files $uri /index.html;");
    const assets = location(serverConf, "/assets/");
    expect(assets).toContain("try_files $uri =404;");
    expect(assets).toContain("max-age=31536000, immutable");
  });

  it("fills in the API upstream everywhere", () => {
    const rendered = renderNginx({ apiUpstream: "api.test:3100", headers });
    expect(rendered.serverConf).toContain("set $api_upstream api.test:3100;");
    expect(rendered.serverConf).not.toContain("__API_UPSTREAM__");
  });

  it.each(["api", "api:3000; evil", "http://api:3000", "api:3000\nlocation"])(
    "refuses the upstream %j",
    (apiUpstream) => {
      expect(() => renderNginx({ apiUpstream, headers })).toThrow(/host:port/);
    },
  );

  it.each(['a"b', "a\\b", "a$b", "a\nb", "a;b"])(
    "refuses the header value %j",
    (value) => {
      expect(() => renderNginx({ headers: { "X-Test": value } })).toThrow(
        /X-Test/,
      );
    },
  );

  it("allows the semicolons between the directives of a policy", () => {
    const value = "default-src 'self'; object-src 'none'";
    expect(renderNginx({ headers: { "X-Test": value } }).headersConf).toContain(
      value,
    );
  });

  it("keeps the template in the repository in step with what it renders", () => {
    const template = readFileSync(
      resolve(import.meta.dirname, "../nginx/default.conf.template"),
      "utf8",
    );
    expect(template).toContain("__API_UPSTREAM__");
    expect(serverConf).toContain("listen 8080;");
  });
});
