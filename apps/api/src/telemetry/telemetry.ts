import { context, metrics, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
  type MetricReader,
} from "@opentelemetry/sdk-metrics";
import {
  BatchSpanProcessor,
  TracerProvider,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace";
import type { AppConfig } from "../config/app-config.js";

export const SERVICE_NAME = "orderpilot-api";

export interface Telemetry {
  /** True when spans and metrics leave the process over OTLP. */
  readonly exporting: boolean;
  shutdown(): Promise<void>;
}

export interface TelemetryOptions {
  /** Tests add an in-memory processor or reader here to read what was recorded. */
  readonly extraSpanProcessors?: readonly SpanProcessor[];
  readonly extraMetricReaders?: readonly MetricReader[];
}

/**
 * Starts OpenTelemetry for the API (ADR 0021). Spans and metrics are always
 * made, so a log line can carry its trace id; they leave the process only
 * when OTEL_EXPORTER_OTLP_ENDPOINT is set. Exact versions are in package.json.
 *
 * Built by hand rather than with the Node SDK: the SDK reads exporters from
 * the environment and would export to a default address when none is set.
 */
export function initTelemetry(
  config: AppConfig,
  options: TelemetryOptions = {},
): Telemetry {
  const endpoint = config.monitoring.otlpEndpoint;
  const resource = resourceFromAttributes({
    "service.name": SERVICE_NAME,
    "service.version": config.gitSha ?? "dev",
    "deployment.environment.name": config.appEnv,
  });

  const spanProcessors: SpanProcessor[] = [
    ...(options.extraSpanProcessors ?? []),
  ];
  const readers: MetricReader[] = [...(options.extraMetricReaders ?? [])];
  if (endpoint !== null) {
    spanProcessors.push(
      new BatchSpanProcessor({
        exporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
      }),
    );
    readers.push(
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
        exportIntervalMillis: 15_000,
      }),
    );
  }

  const tracerProvider = new TracerProvider({ resource, spanProcessors });
  const meterProvider = new MeterProvider({ resource, readers });
  // A request's span must stay current across awaits, so a service can find it.
  context.setGlobalContextManager(
    new AsyncLocalStorageContextManager().enable(),
  );
  trace.setGlobalTracerProvider(tracerProvider);
  metrics.setGlobalMeterProvider(meterProvider);

  return {
    exporting: endpoint !== null,
    async shutdown() {
      await tracerProvider.shutdown();
      await meterProvider.shutdown();
      trace.disable();
      metrics.disable();
      context.disable();
    },
  };
}
