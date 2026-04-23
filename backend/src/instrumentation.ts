import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: 'badminton-backend',
  [ATTR_SERVICE_VERSION]: '1.0.0',
});

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

const traceExporter = new OTLPTraceExporter({
  url: `${otlpEndpoint}/v1/traces`,
});

const logExporter = new OTLPLogExporter({
  url: `${otlpEndpoint}/v1/logs`,
});

const sdk = new NodeSDK({
  resource,
  traceExporter,
  logRecordProcessors: [new BatchLogRecordProcessor(logExporter)],
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    })
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('[OTEL] Tracing shutdown'))
    .finally(() => process.exit(0));
});

console.log('[OTEL] Auto-Instrumentation & OTLP Exporter Ready!');
