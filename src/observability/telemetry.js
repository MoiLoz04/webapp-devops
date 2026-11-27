
require('dotenv').config();

const enabled = process.env.OTEL_ENABLED === 'true';

if (enabled) {
  const { NodeSDK } = require('@opentelemetry/sdk-node');

  const {
    HttpInstrumentation
  } = require('@opentelemetry/instrumentation-http');

  const {
    ExpressInstrumentation
  } = require('@opentelemetry/instrumentation-express');

  const {
    UndiciInstrumentation
  } = require('@opentelemetry/instrumentation-undici');

  const {
    OTLPTraceExporter
  } = require('@opentelemetry/exporter-trace-otlp-http');

  const {
    OTLPMetricExporter
  } = require('@opentelemetry/exporter-metrics-otlp-http');

  const {
    OTLPLogExporter
  } = require('@opentelemetry/exporter-logs-otlp-http');

  const {
    PeriodicExportingMetricReader
  } = require('@opentelemetry/sdk-metrics');

  const {
    SimpleLogRecordProcessor
  } = require('@opentelemetry/sdk-logs');

  const logHeaders = Object.fromEntries(
    (process.env.OTEL_EXPORTER_OTLP_HEADERS || '')
      .split(',')
      .filter(header => header.includes('='))
      .map(header => {
        const index = header.indexOf('=');

        return [
          header.slice(0, index).trim(),
          decodeURIComponent(
            header.slice(index + 1).trim()
          )
        ];
      })
  );

  logHeaders['stream-name'] = 'default';

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    .replace(/\/+$/, '');

  const logExporter = new OTLPLogExporter({
    url: `${endpoint}/v1/logs`,
    headers: logHeaders
  });

  const logProcessor = new SimpleLogRecordProcessor({
    exporter: logExporter
  });

  const sdk = new NodeSDK({
    serviceName: 'webapp-devops',

    traceExporter: new OTLPTraceExporter(),

    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      exportIntervalMillis: 15000,
      exportTimeoutMillis: 10000
    }),

    logRecordProcessors: [
      logProcessor
    ],

    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (request) =>
          request.url === '/api/health'
      }),

      new ExpressInstrumentation(),

      new UndiciInstrumentation()
    ]
  });

  sdk.start();

  console.log('[OpenTelemetry] Instrumentacion iniciada');

  let shuttingDown = false;

  const shutdown = async () => {
    if (shuttingDown) return;

    shuttingDown = true;

    try {
      await sdk.shutdown();
    } catch (error) {
      console.error('[OpenTelemetry]', error.message);
    } finally {
      process.exit(0);
    }
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
