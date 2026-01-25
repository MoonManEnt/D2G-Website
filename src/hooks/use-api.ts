'use client';

// ============================================================================
// DISPUTE2GO - Generic API Hooks
// Base hooks for data fetching and mutations
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiError } from '@/lib/api-client';

// ============================================================================
// Types
// ============================================================================

export interface UseApiQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

export interface UseApiQueryOptions {
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
  staleTime?: number;
}

export interface UseMutationResult<TData, TVariables> {
  mutate: (variables: TVariables) => Promise<TData>;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  data: TData | null;
  loading: boolean;
  error: ApiError | null;
  reset: () => void;
}

export interface UseMutationOptions<TData> {
  onSuccess?: (data: TData) => void;
  onError?: (error: ApiError) => void;
  onSettled?: () => void;
}

// ============================================================================
// useApiQuery Hook
// Generic data fetching hook with caching and refetch support
// ============================================================================

export function useApiQuery<T>(
  fetchFn: () => Promise<T>,
  deps: React.DependencyList = [],
  options: UseApiQueryOptions = {}
): UseApiQueryResult<T> {
  const { enabled = true, refetchOnWindowFocus = false } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<ApiError | null>(null);

  // Use ref to track if component is mounted
  const isMountedRef = useRef(true);

  // Memoize fetchFn to avoid unnecessary re-fetches
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const refetch = useCallback(async () => {
    if (!isMountedRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFnRef.current();
      if (isMountedRef.current) {
        setData(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const apiError = err instanceof ApiError
          ? err
          : new ApiError(0, err instanceof Error ? err.message : 'Unknown error');
        setError(apiError);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;

    if (enabled) {
      refetch();
    } else {
      setLoading(false);
    }

    return () => {
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  // Refetch on window focus
  useEffect(() => {
    if (!refetchOnWindowFocus || !enabled) return;

    const handleFocus = () => {
      refetch();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnWindowFocus, enabled, refetch]);

  return { data, loading, error, refetch };
}

// ============================================================================
// useMutation Hook
// Generic mutation hook for POST/PUT/PATCH/DELETE operations
// ============================================================================

export function useMutation<TData = unknown, TVariables = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseMutationOptions<TData> = {}
): UseMutationResult<TData, TVariables> {
  const { onSuccess, onError, onSettled } = options;

  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Use ref to track if component is mounted
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const mutateAsync = useCallback(
    async (variables: TVariables): Promise<TData> => {
      if (!isMountedRef.current) {
        throw new ApiError(0, 'Component unmounted');
      }

      setLoading(true);
      setError(null);

      try {
        const result = await mutationFn(variables);

        if (isMountedRef.current) {
          setData(result);
          onSuccess?.(result);
        }

        return result;
      } catch (err) {
        const apiError = err instanceof ApiError
          ? err
          : new ApiError(0, err instanceof Error ? err.message : 'Unknown error');

        if (isMountedRef.current) {
          setError(apiError);
          onError?.(apiError);
        }

        throw apiError;
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          onSettled?.();
        }
      }
    },
    [mutationFn, onSuccess, onError, onSettled]
  );

  const mutate = useCallback(
    (variables: TVariables): Promise<TData> => {
      return mutateAsync(variables).catch(() => {
        // Swallow error - it's already stored in state
        return null as unknown as TData;
      });
    },
    [mutateAsync]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { mutate, mutateAsync, data, loading, error, reset };
}

// ============================================================================
// useInfiniteQuery Hook
// For paginated data loading
// ============================================================================

export interface UseInfiniteQueryResult<T> {
  data: T[];
  loading: boolean;
  loadingMore: boolean;
  error: ApiError | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

export interface UseInfiniteQueryOptions<T> {
  enabled?: boolean;
  pageSize?: number;
  getNextPageParam?: (lastPage: T[], allPages: T[][]) => number | undefined;
}

export function useInfiniteQuery<T>(
  fetchFn: (page: number, pageSize: number) => Promise<{ items: T[]; total: number }>,
  deps: React.DependencyList = [],
  options: UseInfiniteQueryOptions<T> = {}
): UseInfiniteQueryResult<T> {
  const { enabled = true, pageSize = 20 } = options;

  const [pages, setPages] = useState<T[][]>([]);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(0);

  const isMountedRef = useRef(true);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const refetch = useCallback(async () => {
    if (!isMountedRef.current) return;

    setLoading(true);
    setError(null);
    setPages([]);
    setCurrentPage(0);

    try {
      const result = await fetchFnRef.current(0, pageSize);
      if (isMountedRef.current) {
        setPages([result.items]);
        setHasMore(result.items.length < result.total);
        setCurrentPage(1);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const apiError = err instanceof ApiError
          ? err
          : new ApiError(0, err instanceof Error ? err.message : 'Unknown error');
        setError(apiError);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [pageSize]);

  const loadMore = useCallback(async () => {
    if (!isMountedRef.current || !hasMore || loadingMore) return;

    setLoadingMore(true);

    try {
      const result = await fetchFnRef.current(currentPage, pageSize);
      if (isMountedRef.current) {
        setPages((prev) => [...prev, result.items]);
        const totalLoaded = (currentPage + 1) * pageSize + result.items.length;
        setHasMore(totalLoaded < result.total);
        setCurrentPage((prev) => prev + 1);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const apiError = err instanceof ApiError
          ? err
          : new ApiError(0, err instanceof Error ? err.message : 'Unknown error');
        setError(apiError);
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingMore(false);
      }
    }
  }, [currentPage, pageSize, hasMore, loadingMore]);

  useEffect(() => {
    isMountedRef.current = true;

    if (enabled) {
      refetch();
    } else {
      setLoading(false);
    }

    return () => {
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const data = pages.flat();

  return { data, loading, loadingMore, error, hasMore, loadMore, refetch };
}

// ============================================================================
// useDebounce Hook
// For debouncing search inputs
// ============================================================================

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============================================================================
// usePrevious Hook
// Track previous value of a variable
// ============================================================================

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

export default useApiQuery;
