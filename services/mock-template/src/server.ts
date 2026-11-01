import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";

const SERVICE = "mock-template";

/**
 * The contract of every mock service: `GET /health` answers 200, each answer
 * says it comes from a mock, and an error uses the API's one envelope. The
 * mock image's health check depends on the first of these.
 */
export function createMockServer(): Server {
  return createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("X-Mock-Service", SERVICE);
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200);
      res.end(JSON.stringify({ status: "ok", service: SERVICE, mock: true }));
      return;
    }
    res.writeHead(404);
    res.end(
      JSON.stringify({
        error: {
          code: "NOT_FOUND",
          message: "This mock has no such route.",
          details: [],
          traceId: randomUUID(),
        },
      }),
    );
  });
}
