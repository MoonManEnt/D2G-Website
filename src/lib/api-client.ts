// ============================================================================
// DISPUTE2GO - API CLIENT
// TypeScript API client for connecting to Next.js API routes
// ============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// ============================================================================
// Types
// ============================================================================

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export interface ApiErrorData {
  message?: string;
  code?: string;
  details?: Record<string, unknown>;
  originalError?: unknown;
}

// ============================================================================
// API Error Class
// ============================================================================

export class ApiError extends Error {
  public readonly status: number;
  public readonly data: ApiErrorData;

  constructor(status: number, message: string, data: ApiErrorData = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }

  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

// ============================================================================
// API Client Class
// ============================================================================

export class ApiClient {
  private baseUrl: string;
  private token: string | null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.token = null;
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  async request<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new ApiError(
          response.status,
          error.message || 'Request failed',
          error
        );
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return response.json();
      }

      return {} as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        0,
        error instanceof Error ? error.message : 'Network error',
        { originalError: error }
      );
    }
  }

  get<T = unknown>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const filteredParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          filteredParams[key] = String(value);
        }
      });
    }
    const queryString = Object.keys(filteredParams).length > 0
      ? '?' + new URLSearchParams(filteredParams).toString()
      : '';
    return this.request<T>(`${endpoint}${queryString}`, { method: 'GET' });
  }

  post<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body: data });
  }

  put<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body: data });
  }

  patch<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PATCH', body: data });
  }

  delete<T = unknown>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Special method for file uploads (FormData)
  async upload<T = unknown>(endpoint: string, formData: FormData): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      // Note: Don't set Content-Type for FormData - browser will set it with boundary
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new ApiError(response.status, error.message || 'Upload failed', error);
      }

      return response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        0,
        error instanceof Error ? error.message : 'Upload failed',
        { originalError: error }
      );
    }
  }

  // Special method for downloading files (returns Blob)
  async download(endpoint: string): Promise<Blob> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
    };

    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new ApiError(response.status, 'Download failed');
      }

      return response.blob();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        0,
        error instanceof Error ? error.message : 'Download failed',
        { originalError: error }
      );
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const apiClient = new ApiClient();

// ============================================================================
// API Namespaces
// ============================================================================

export const clientsApi = {
  list: <T = unknown>(params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<T>('/clients', params),

  get: <T = unknown>(id: string) =>
    apiClient.get<T>(`/clients/${id}`),

  create: <T = unknown>(data: unknown) =>
    apiClient.post<T>('/clients', data),

  update: <T = unknown>(id: string, data: unknown) =>
    apiClient.patch<T>(`/clients/${id}`, data),

  delete: <T = unknown>(id: string) =>
    apiClient.delete<T>(`/clients/${id}`),

  getReports: <T = unknown>(id: string) =>
    apiClient.get<T>(`/clients/${id}/reports`),

  getAccounts: <T = unknown>(id: string, params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<T>(`/clients/${id}/accounts`, params),

  getNegativeAccounts: <T = unknown>(id: string) =>
    apiClient.get<T>(`/clients/${id}/accounts/negative`),

  getDisputes: <T = unknown>(id: string) =>
    apiClient.get<T>(`/clients/${id}/disputes`),

  getTimeline: <T = unknown>(id: string) =>
    apiClient.get<T>(`/clients/${id}/timeline`),

  updateStage: <T = unknown>(id: string, stage: string) =>
    apiClient.patch<T>(`/clients/${id}/stage`, { stage }),

  updatePriority: <T = unknown>(id: string, priority: string) =>
    apiClient.patch<T>(`/clients/${id}/priority`, { priority }),

  getArchived: <T = unknown>(params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<T>('/clients/archived', params),

  archive: <T = unknown>(id: string) =>
    apiClient.post<T>(`/clients/${id}/archive`),

  restore: <T = unknown>(id: string) =>
    apiClient.post<T>(`/clients/${id}/restore`),
};

export const disputesApi = {
  list: <T = unknown>(params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<T>('/disputes', params),

  get: <T = unknown>(id: string) =>
    apiClient.get<T>(`/disputes/${id}`),

  create: <T = unknown>(data: unknown) =>
    apiClient.post<T>('/disputes', data),

  update: <T = unknown>(id: string, data: unknown) =>
    apiClient.patch<T>(`/disputes/${id}`, data),

  delete: <T = unknown>(id: string) =>
    apiClient.delete<T>(`/disputes/${id}`),

  getLetter: <T = unknown>(id: string) =>
    apiClient.get<T>(`/disputes/${id}/letter`),

  updateLetter: <T = unknown>(id: string, content: string) =>
    apiClient.put<T>(`/disputes/${id}/letter`, { content }),

  regenerateLetter: <T = unknown>(id: string, options?: Record<string, unknown>) =>
    apiClient.post<T>(`/disputes/${id}/letter/regenerate`, options),

  approve: <T = unknown>(id: string) =>
    apiClient.post<T>(`/disputes/${id}/approve`),

  markSent: <T = unknown>(id: string, data: unknown) =>
    apiClient.post<T>(`/disputes/${id}/sent`, data),

  logResponse: <T = unknown>(id: string, data: unknown) =>
    apiClient.post<T>(`/disputes/${id}/response`, data),

  getPendingResponses: <T = unknown>() =>
    apiClient.get<T>('/disputes/pending-responses'),

  getNeedingAction: <T = unknown>() =>
    apiClient.get<T>('/disputes/needing-action'),

  getBulk: <T = unknown>(ids: string[]) =>
    apiClient.post<T>('/disputes/bulk', { ids }),

  generateDocx: (id: string) =>
    apiClient.download(`/disputes/${id}/docx`),

  generatePdf: (id: string) =>
    apiClient.download(`/disputes/${id}/pdf`),
};

export const ameliaApi = {
  generateInsights: <T = unknown>(data: unknown) =>
    apiClient.post<T>('/amelia/insights', data),

  regenerateSection: <T = unknown>(data: unknown) =>
    apiClient.post<T>('/amelia/regenerate-section', data),

  checkEoscar: <T = unknown>(content: string) =>
    apiClient.post<T>('/amelia/eoscar-check', { content }),

  getRecommendedFlow: <T = unknown>(accounts: unknown[]) =>
    apiClient.post<T>('/amelia/recommend-flow', { accounts }),

  getToneRecommendation: <T = unknown>(round: number, history: unknown) =>
    apiClient.post<T>('/amelia/recommend-tone', { round, history }),

  generateCreditDNA: <T = unknown>(clientId: string) =>
    apiClient.post<T>(`/amelia/credit-dna/${clientId}`),

  generateDispute: <T = unknown>(disputeId: string, data?: unknown) =>
    apiClient.post<T>(`/disputes/${disputeId}/amelia`, data),

  generateCFPB: <T = unknown>(disputeId: string, data?: unknown) =>
    apiClient.post<T>(`/disputes/${disputeId}/cfpb`, data),
};

export const cfpbApi = {
  generate: <T = unknown>(data: unknown) =>
    apiClient.post<T>('/cfpb/generate', data),

  getTemplates: <T = unknown>() =>
    apiClient.get<T>('/cfpb/templates'),

  saveDraft: <T = unknown>(data: unknown) =>
    apiClient.post<T>('/cfpb/drafts', data),

  getByClient: <T = unknown>(clientId: string) =>
    apiClient.get<T>(`/cfpb/client/${clientId}`),
};

export const reportsApi = {
  upload: <T = unknown>(clientId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.upload<T>(`/reports/upload/${clientId}`, formData);
  },

  get: <T = unknown>(id: string) =>
    apiClient.get<T>(`/reports/${id}`),

  getDiff: <T = unknown>(reportId1: string, reportId2: string) =>
    apiClient.get<T>('/reports/diff', { report1: reportId1, report2: reportId2 }),

  reparse: <T = unknown>(id: string) =>
    apiClient.post<T>(`/reports/${id}/reparse`),

  getPdf: (id: string) =>
    apiClient.download(`/reports/${id}/pdf`),
};

export const lettersApi = {
  generate: <T = unknown>(disputeId: string) =>
    apiClient.get<T>(`/letters/${disputeId}/generate`),

  download: (disputeId: string) =>
    apiClient.download(`/letters/${disputeId}/download`),

  preview: <T = unknown>(disputeId: string) =>
    apiClient.get<T>(`/letters/${disputeId}/preview`),
};

export const analyticsApi = {
  getDashboardStats: <T = unknown>() =>
    apiClient.get<T>('/analytics/dashboard'),

  getSuccessRateByCRA: <T = unknown>() =>
    apiClient.get<T>('/analytics/success-by-cra'),

  getSuccessRateByFlow: <T = unknown>() =>
    apiClient.get<T>('/analytics/success-by-flow'),

  getMonthlyTrends: <T = unknown>(months: number = 6) =>
    apiClient.get<T>('/analytics/monthly-trends', { months }),

  getClientFunnel: <T = unknown>() =>
    apiClient.get<T>('/analytics/client-funnel'),

  getViolationStats: <T = unknown>() =>
    apiClient.get<T>('/analytics/violations'),

  getAll: <T = unknown>() =>
    apiClient.get<T>('/analytics'),
};

export const teamApi = {
  list: <T = unknown>() =>
    apiClient.get<T>('/team'),

  get: <T = unknown>(id: string) =>
    apiClient.get<T>(`/team/${id}`),

  invite: <T = unknown>(data: unknown) =>
    apiClient.post<T>('/team', data),

  update: <T = unknown>(id: string, data: unknown) =>
    apiClient.patch<T>(`/team/${id}`, data),

  remove: <T = unknown>(id: string) =>
    apiClient.delete<T>(`/team/${id}`),
};

export const remindersApi = {
  list: <T = unknown>(params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<T>('/reminders', params),

  get: <T = unknown>(id: string) =>
    apiClient.get<T>(`/reminders/${id}`),

  create: <T = unknown>(data: unknown) =>
    apiClient.post<T>('/reminders', data),

  update: <T = unknown>(id: string, data: unknown) =>
    apiClient.patch<T>(`/reminders/${id}`, data),

  delete: <T = unknown>(id: string) =>
    apiClient.delete<T>(`/reminders/${id}`),

  complete: <T = unknown>(id: string) =>
    apiClient.post<T>(`/reminders/${id}/complete`),
};

export const evidenceApi = {
  list: <T = unknown>(params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<T>('/evidence', params),

  create: <T = unknown>(data: unknown) =>
    apiClient.post<T>('/evidence', data),

  delete: <T = unknown>(id: string) =>
    apiClient.delete<T>(`/evidence/${id}`),
};

export default apiClient;
