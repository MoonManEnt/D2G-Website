// =============================================================================
// API PAGINATION UTILITIES
// =============================================================================
// Offset-based pagination for list endpoints.
// Provides consistent pagination parameters parsing and response formatting.
// =============================================================================

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parse pagination parameters from URL search params.
 * Supports both `page` (1-indexed) and `limit` query params.
 */
export function parsePaginationParams(searchParams: URLSearchParams): PaginationParams {
  const rawPage = parseInt(searchParams.get("page") || String(DEFAULT_PAGE), 10);
  const rawLimit = parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10);

  const page = Math.max(1, isNaN(rawPage) ? DEFAULT_PAGE : rawPage);
  const limit = Math.min(MAX_LIMIT, Math.max(1, isNaN(rawLimit) ? DEFAULT_LIMIT : rawLimit));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Build a paginated response with metadata.
 */
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  const pages = Math.ceil(total / params.limit);

  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      pages,
      hasNext: params.page < pages,
      hasPrev: params.page > 1,
    },
  };
}
