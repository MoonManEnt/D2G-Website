import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Server-side Sentry initialization
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

      // Performance Monitoring
      tracesSampleRate: 1.0,

      // Only enable in production
      enabled: process.env.NODE_ENV === "production",

      // Set environment
      environment: process.env.NODE_ENV,

      // Before sending, sanitize sensitive data
      beforeSend(event) {
        // Remove sensitive headers
        if (event.request?.headers) {
          delete event.request.headers["authorization"];
          delete event.request.headers["cookie"];
        }

        // Sanitize any SSN or credit card patterns in messages
        if (event.message) {
          event.message = event.message
            .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN REDACTED]")
            .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[CARD REDACTED]");
        }

        return event;
      },
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // Edge runtime Sentry initialization
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

      // Performance Monitoring
      tracesSampleRate: 1.0,

      // Only enable in production
      enabled: process.env.NODE_ENV === "production",

      // Set environment
      environment: process.env.NODE_ENV,
    });
  }
}
