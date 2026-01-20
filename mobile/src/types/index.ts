/**
 * Type definitions for Dispute2Go Mobile App
 */

// User & Auth Types
export interface User {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Client Types
export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  disputeCount?: number;
  latestScore?: number;
}

// Dispute Types
export interface Dispute {
  id: string;
  clientId: string;
  clientName: string;
  cra: "EQUIFAX" | "EXPERIAN" | "TRANSUNION";
  status: DisputeStatus;
  round: number;
  flow: string;
  createdAt: string;
  sentDate?: string;
  resolvedAt?: string;
}

export type DisputeStatus =
  | "DRAFT"
  | "APPROVED"
  | "SENT"
  | "RESPONDED"
  | "RESOLVED_POSITIVE"
  | "RESOLVED_NEGATIVE"
  | "RESOLVED_PARTIAL";

// Credit Score Types
export interface CreditScore {
  id: string;
  cra: string;
  score: number;
  recordedAt: string;
}

// Navigation Types
export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  ClientDetail: { clientId: string };
  DisputeDetail: { disputeId: string };
};

export type MainTabParamList = {
  Dashboard: undefined;
  Clients: undefined;
  Disputes: undefined;
  Profile: undefined;
};

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
