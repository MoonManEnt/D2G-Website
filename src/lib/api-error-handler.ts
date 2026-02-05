import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createLogger } from "./logger";
const log = createLogger("api-error-handler");

interface ApiErrorOptions {
  context?: string;
  userId?: string;
  organizationId?: string;
  extra?: Record<string, unknown>;
}

export class AppError extends Error {
  code: string;
  statusCode: number;
  details?: unknown;

  constructor(message: string, code: string, statusCode: number = 500, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Pre-defined errors for consistency
export const ApiErrors = {
  unauthorized: () => new AppError("Authentication required", "UNAUTHORIZED", 401),
  forbidden: () => new AppError("You don't have permission to perform this action", "FORBIDDEN", 403),
  notFound: (resource: string) => new AppError(`${resource} not found`, "NOT_FOUND", 404),
  badRequest: (message: string) => new AppError(message, "BAD_REQUEST", 400),
  conflict: (message: string) => new AppError(message, "CONFLICT", 409),
  rateLimited: () => new AppError("Too many requests. Please try again later.", "RATE_LIMITED", 429),
  internal: (message?: string) => new AppError(message || "An internal error occurred", "INTERNAL_ERROR", 500),
  validationFailed: (errors: unknown) => new AppError("Validation failed", "VALIDATION_ERROR", 400, errors),
};

export function handleApiError(error: unknown, options: ApiErrorOptions = {}): NextResponse {
  const { context, userId, organizationId, extra } = options;

  // Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: error.flatten(),
      },
      { status: 400 }
    );
  }

  // Known application errors
  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      Sentry.captureException(error, {
        extra: { context, userId, organizationId, ...extra },
      });
    }
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
      },
      { status: error.statusCode }
    );
  }

  // Prisma errors
  if (error && typeof error === "object" && "code" in error) {
    const prismaError = error as { code: string; message?: string; meta?: unknown };

    switch (prismaError.code) {
      case "P2002":
        return NextResponse.json(
          { error: "A record with this data already exists", code: "DUPLICATE_ENTRY" },
          { status: 409 }
        );
      case "P2025":
        return NextResponse.json(
          { error: "Record not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      case "P2003":
        return NextResponse.json(
          { error: "Referenced record not found", code: "FOREIGN_KEY_ERROR" },
          { status: 400 }
        );
      default:
        Sentry.captureException(error, {
          extra: { context, userId, organizationId, prismaCode: prismaError.code, ...extra },
        });
        return NextResponse.json(
          { error: "Database error", code: "DATABASE_ERROR" },
          { status: 500 }
        );
    }
  }

  // Unknown errors
  const message = error instanceof Error ? error.message : "An unexpected error occurred";
  log.error({ err: error }, "[API Error] ${context || \"Unknown context\"}");

  Sentry.captureException(error, {
    extra: { context, userId, organizationId, ...extra },
  });

  return NextResponse.json(
    { error: message, code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}
