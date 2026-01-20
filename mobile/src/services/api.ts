/**
 * API Service for Dispute2Go Mobile App
 */

import * as SecureStore from "expo-secure-store";
import { ApiResponse, Client, Dispute, CreditScore, PaginatedResponse } from "../types";

// API Base URL
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";

// Token storage keys
const ACCESS_TOKEN_KEY = "dispute2go_access_token";
const REFRESH_TOKEN_KEY = "dispute2go_refresh_token";

// Token management
export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function setAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

// API Client
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const accessToken = await getAccessToken();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (accessToken) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle 401 - try to refresh token
    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // Retry request with new token
        const newToken = await getAccessToken();
        (headers as Record<string, string>)["Authorization"] = `Bearer ${newToken}`;
        const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers,
        });
        const retryData = await retryResponse.json();
        return { success: retryResponse.ok, data: retryData };
      }
      return { success: false, error: "Session expired. Please login again." };
    }

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || "Request failed" };
    }

    return { success: true, data };
  } catch (error) {
    console.error("API request error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/portal/auth`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    if (data.accessToken) {
      await setAccessToken(data.accessToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// =============================================================================
// AUTH ENDPOINTS
// =============================================================================

export async function login(
  email: string,
  password: string
): Promise<ApiResponse<{ accessToken: string; refreshToken: string; user: unknown }>> {
  const response = await apiRequest<{ accessToken: string; refreshToken: string; user: unknown }>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }
  );

  if (response.success && response.data) {
    await setAccessToken(response.data.accessToken);
    await setRefreshToken(response.data.refreshToken);
  }

  return response;
}

export async function logout(): Promise<void> {
  await clearTokens();
}

export async function getProfile(): Promise<ApiResponse<{ user: unknown }>> {
  return apiRequest("/auth/me");
}

// =============================================================================
// CLIENT ENDPOINTS
// =============================================================================

export async function getClients(
  page: number = 1,
  limit: number = 20,
  search?: string
): Promise<ApiResponse<PaginatedResponse<Client>>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search) params.set("search", search);

  return apiRequest(`/clients?${params}`);
}

export async function getClient(clientId: string): Promise<ApiResponse<Client>> {
  return apiRequest(`/clients/${clientId}`);
}

export async function getClientScores(
  clientId: string
): Promise<ApiResponse<{ scores: CreditScore[] }>> {
  return apiRequest(`/clients/${clientId}/scores`);
}

// =============================================================================
// DISPUTE ENDPOINTS
// =============================================================================

export async function getDisputes(
  page: number = 1,
  limit: number = 20,
  status?: string
): Promise<ApiResponse<PaginatedResponse<Dispute>>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (status) params.set("status", status);

  return apiRequest(`/disputes?${params}`);
}

export async function getDispute(disputeId: string): Promise<ApiResponse<Dispute>> {
  return apiRequest(`/disputes/${disputeId}`);
}

export async function getClientDisputes(
  clientId: string,
  page: number = 1,
  limit: number = 20
): Promise<ApiResponse<PaginatedResponse<Dispute>>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  return apiRequest(`/clients/${clientId}/disputes?${params}`);
}

// =============================================================================
// ANALYTICS ENDPOINTS
// =============================================================================

export async function getAnalytics(): Promise<ApiResponse<{
  summary: {
    clientCount: number;
    activeDisputeCount: number;
    resolvedDisputeCount: number;
    resolutionRate: number;
  };
  charts: unknown;
}>> {
  return apiRequest("/analytics");
}

// =============================================================================
// NOTIFICATIONS
// =============================================================================

export async function registerPushToken(token: string): Promise<ApiResponse<void>> {
  return apiRequest("/notifications/register", {
    method: "POST",
    body: JSON.stringify({ pushToken: token }),
  });
}
