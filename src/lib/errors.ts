/**
 * Centralized Error Handling Utilities
 *
 * Provides consistent error handling across the application with Sentry integration.
 */

import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

// Custom error types
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "INTERNAL_ERROR",
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(message, 400, field ? `VALIDATION_ERROR_${field.toUpperCase()}` : "VALIDATION_ERROR");
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, 401, "AUTHENTICATION_ERROR");
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Access denied") {
    super(message, 403, "AUTHORIZATION_ERROR");
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super(
      `Too many requests. ${retryAfter ? `Try again in ${retryAfter} seconds.` : "Please slow down."}`,
      429,
      "RATE_LIMIT_EXCEEDED"
    );
  }
}

export class ExternalServiceError extends AppError {
  public readonly service: string;

  constructor(service: string, message: string) {
    super(`${service} error: ${message}`, 502, `${service.toUpperCase()}_ERROR`, true);
    this.service = service;
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, 500, "CONFIGURATION_ERROR", false);
  }
}

/**
 * Capture and report error to Sentry with context
 */
export function captureError(
  error: Error | unknown,
  context?: {
    userId?: string;
    organizationId?: string;
    action?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  if (!(error instanceof Error)) {
    Sentry.captureMessage(String(error), {
      level: "error",
      extra: context,
    });
    return;
  }

  // Set user context if available
  if (context?.userId) {
    Sentry.setUser({ id: context.userId });
  }

  // Add tags and extra context
  Sentry.withScope((scope) => {
    if (context?.organizationId) {
      scope.setTag("organizationId", context.organizationId);
    }
    if (context?.action) {
      scope.setTag("action", context.action);
    }
    if (context?.metadata) {
      scope.setExtras(context.metadata);
    }

    // Set error level based on error type
    if (error instanceof AppError) {
      scope.setTag("errorCode", error.code);
      scope.setLevel(error.isOperational ? "warning" : "error");
    }

    Sentry.captureException(error);
  });
}

/**
 * Handle errors in API routes and return appropriate response
 */
export function handleApiError(
  error: Error | unknown,
  context?: {
    userId?: string;
    organizationId?: string;
    action?: string;
  }
): NextResponse {
  // Log to Sentry
  captureError(error, context);

  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    console.error("API Error:", error);
  }

  // Handle known error types
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: error.statusCode }
    );
  }

  // Handle Prisma errors
  if (error instanceof Error && error.name === "PrismaClientKnownRequestError") {
    const prismaError = error as { code?: string };

    switch (prismaError.code) {
      case "P2002":
        return NextResponse.json(
          { error: "A record with this identifier already exists", code: "DUPLICATE_RECORD" },
          { status: 409 }
        );
      case "P2025":
        return NextResponse.json(
          { error: "Record not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      default:
        return NextResponse.json(
          { error: "Database error", code: "DATABASE_ERROR" },
          { status: 500 }
        );
    }
  }

  // Handle unknown errors
  return NextResponse.json(
    {
      error: process.env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : error instanceof Error
          ? error.message
          : "Unknown error",
      code: "INTERNAL_ERROR",
    },
    { status: 500 }
  );
}

/**
 * Wrapper for async API route handlers with error handling
 */
export function withErrorHandling<T extends (...args: Parameters<T>) => Promise<NextResponse>>(
  handler: T,
  context?: {
    action?: string;
  }
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error, { action: context?.action });
    }
  }) as T;
}

/**
 * Log error without throwing (for non-critical errors)
 */
export function logError(
  message: string,
  error?: Error | unknown,
  metadata?: Record<string, unknown>
): void {
  console.error(message, error);

  Sentry.withScope((scope) => {
    if (metadata) {
      scope.setExtras(metadata);
    }
    scope.setLevel("warning");

    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(message);
    }
  });
}

/**
 * Assert condition and throw if false
 */
export function assert(
  condition: unknown,
  message: string,
  ErrorClass: new (message: string) => AppError = ValidationError
): asserts condition {
  if (!condition) {
    throw new ErrorClass(message);
  }
}

/**
 * Safely parse JSON with error handling
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
