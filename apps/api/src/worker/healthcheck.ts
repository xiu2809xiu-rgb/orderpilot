// The worker image's health check: exit 0 while the worker's heartbeat is fresh.
import { isFresh } from "./heartbeat.js";

process.exit(isFresh() ? 0 : 1);
