import * as Sentry from "@sentry/nextjs";

interface PerformanceMetric {
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  userId?: string;
  organizationId?: string;
}

// In-memory metrics buffer (flushed periodically or on threshold)
const metricsBuffer: PerformanceMetric[] = [];
const BUFFER_SIZE = 100;
const SLOW_THRESHOLD_MS = 2000;

export function recordMetric(metric: PerformanceMetric) {
  metricsBuffer.push(metric);

  // Log slow requests
  if (metric.duration > SLOW_THRESHOLD_MS) {
    console.warn(
      `[SLOW REQUEST] ${metric.method} ${metric.endpoint} took ${metric.duration}ms (status: ${metric.statusCode})`
    );
    Sentry.captureMessage(`Slow API request: ${metric.method} ${metric.endpoint}`, {
      level: "warning",
      extra: {
        duration: metric.duration,
        statusCode: metric.statusCode,
        endpoint: metric.endpoint,
      },
    });
  }

  // Flush buffer when full
  if (metricsBuffer.length >= BUFFER_SIZE) {
    flushMetrics();
  }
}

export function flushMetrics() {
  if (metricsBuffer.length === 0) return;

  const metrics = [...metricsBuffer];
  metricsBuffer.length = 0;

  // Calculate summary
  const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
  const slowCount = metrics.filter(m => m.duration > SLOW_THRESHOLD_MS).length;
  const errorCount = metrics.filter(m => m.statusCode >= 500).length;

  console.log(`[PERF] Flushed ${metrics.length} metrics | Avg: ${avgDuration.toFixed(0)}ms | Slow: ${slowCount} | Errors: ${errorCount}`);
}

export function getMetricsSummary() {
  const metrics = [...metricsBuffer];
  if (metrics.length === 0) return null;

  const byEndpoint = new Map<string, number[]>();
  metrics.forEach(m => {
    const key = `${m.method} ${m.endpoint}`;
    if (!byEndpoint.has(key)) byEndpoint.set(key, []);
    byEndpoint.get(key)!.push(m.duration);
  });

  const endpoints = Array.from(byEndpoint.entries()).map(([key, durations]) => ({
    endpoint: key,
    count: durations.length,
    avg: durations.reduce((a, b) => a + b, 0) / durations.length,
    p95: durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)] || 0,
    max: Math.max(...durations),
  }));

  return {
    totalRequests: metrics.length,
    avgDuration: metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length,
    slowRequests: metrics.filter(m => m.duration > SLOW_THRESHOLD_MS).length,
    errorRate: metrics.filter(m => m.statusCode >= 500).length / metrics.length,
    endpoints: endpoints.sort((a, b) => b.avg - a.avg),
  };
}

// Middleware wrapper for API routes
export function withPerformanceTracking<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
  endpointName?: string
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now();
    const req = args[0] as Request;
    const method = req.method;
    const url = new URL(req.url);
    const endpoint = endpointName || url.pathname;

    try {
      const response = await handler(...args);
      const duration = Date.now() - startTime;

      recordMetric({
        endpoint,
        method,
        statusCode: response.status,
        duration,
        timestamp: new Date(),
      });

      // Add timing header
      const headers = new Headers(response.headers);
      headers.set("Server-Timing", `total;dur=${duration}`);
      headers.set("X-Response-Time", `${duration}ms`);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      recordMetric({
        endpoint,
        method,
        statusCode: 500,
        duration,
        timestamp: new Date(),
      });
      throw error;
    }
  }) as T;
}
