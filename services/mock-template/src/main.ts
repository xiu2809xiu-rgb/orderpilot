import { z } from "zod";
import { createMockServer } from "./server.js";

const env = z
  .object({ PORT: z.coerce.number().int().min(1).max(65535).default(8090) })
  .parse(process.env);

const server = createMockServer();
server.listen(env.PORT, "0.0.0.0", () => {
  process.stdout.write(
    `${JSON.stringify({ msg: "mock listening", port: env.PORT })}\n`,
  );
});
process.once("SIGTERM", () => server.close());
