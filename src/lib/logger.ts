import pino from "pino";

const isDev = process.env.NODE_ENV === "development";

// PII patterns to redact from log messages
const PII_PATTERNS: [RegExp, string][] = [
  [/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]"],
  [/\b\d{9}\b/g, "[SSN_REDACTED]"],
  [/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[CARD_REDACTED]"],
];

function redactMessage(msg: string): string {
  let result = msg;
  for (const [pattern, replacement] of PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  ...(isDev
    ? { transport: { target: "pino-pretty", options: { colorize: true } } }
    : {}),
  redact: {
    paths: [
      "password",
      "ssn",
      "ssnLast4",
      "dateOfBirth",
      "creditCard",
      "token",
      "secret",
      "authorization",
      "*.password",
      "*.ssn",
      "*.ssnLast4",
      "*.token",
    ],
    censor: "[REDACTED]",
  },
  formatters: {
    log(obj) {
      // Redact PII from string message
      if (typeof obj.msg === "string") {
        obj.msg = redactMessage(obj.msg);
      }
      return obj;
    },
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
});

// Create child loggers for different modules
export function createLogger(module: string) {
  return logger.child({ module });
}

// Convenience log functions
export function logApiRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number
) {
  logger.info(
    { method, path, statusCode, durationMs, type: "api_request" },
    `${method} ${path} ${statusCode} ${durationMs}ms`
  );
}

export function logDbQuery(
  operation: string,
  model: string,
  durationMs: number
) {
  logger.debug(
    { operation, model, durationMs, type: "db_query" },
    `DB ${operation} ${model} ${durationMs}ms`
  );
}

export function logEmailSent(to: string, category: string, success: boolean) {
  // Redact email for logging
  const maskedEmail = to.replace(/(.{2})(.*)(@.*)/, "$1***$3");
  logger.info(
    { email: maskedEmail, category, success, type: "email" },
    `Email ${category} to ${maskedEmail}: ${success ? "sent" : "failed"}`
  );
}
