const {
  metrics,
  trace,
  logs,
  SeverityNumber
} = require('@opentelemetry/api');

const meter = metrics.getMeter('webapp-devops');
const logger = logs.getLogger('webapp-devops');

const requestCounter = meter.createCounter(
  'webapp.http.requests',
  {
    description: 'Total de peticiones HTTP',
    unit: '1'
  }
);

const errorCounter = meter.createCounter(
  'webapp.http.errors',
  {
    description: 'Total de errores HTTP',
    unit: '1'
  }
);

const requestDuration = meter.createHistogram(
  'webapp.http.duration',
  {
    description: 'Duracion de peticiones HTTP',
    unit: 'ms'
  }
);

function httpMonitor(req, res, next) {
  if (
    process.env.OTEL_ENABLED !== 'true' ||
    req.path === '/api/health'
  ) {
    return next();
  }

  const start = process.hrtime.bigint();
  const span = trace.getActiveSpan();

  res.once('finish', () => {
    const duration =
      Number(process.hrtime.bigint() - start) / 1e6;

    const route = req.route
      ? `${req.baseUrl || ''}${req.route.path}`
      : req.path;

    const attributes = {
      'http.request.method': req.method,
      'http.route': route,
      'http.response.status_code': res.statusCode
    };

    requestCounter.add(1, attributes);
    requestDuration.record(duration, attributes);

    if (res.statusCode >= 400) {
      errorCounter.add(1, attributes);
    }

    const severity =
      res.statusCode >= 500
        ? 'ERROR'
        : res.statusCode >= 400
          ? 'WARN'
          : 'INFO';

    const spanContext = span?.spanContext();

    logger.emit({
      severityText: severity,
      severityNumber: SeverityNumber[severity],

      body: `${req.method} ${route} - ${res.statusCode}`,

      attributes: {
        ...attributes,
        application: 'webapp-devops',
        environment: process.env.NODE_ENV || 'development',
        duration_ms: duration,
        trace_id: spanContext?.traceId || '',
        span_id: spanContext?.spanId || ''
      }
    });
  });

  next();
}

module.exports = httpMonitor;