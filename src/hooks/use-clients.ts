'use client';

// ============================================================================
// DISPUTE2GO - Client Hooks
// React hooks for client-related API operations
// ============================================================================

import { useCallback, useMemo } from 'react';
import { useApiQuery, useMutation, useDebounce } from './use-api';
import { clientsApi, reportsApi } from '@/lib/api-client';
import type { CRA, FlowType, AccountStatus } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  ssn4?: string;
  dateOfBirth?: string;
  stage: string;
  priority: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  archivedAt?: string;
  _count?: {
    disputes: number;
    reports: number;
    accounts: number;
  };
  creditScores?: CreditScores;
}

export interface CreditScores {
  experian?: number;
  equifax?: number;
  transunion?: number;
  updatedAt?: string;
}

export interface ClientAccount {
  id: string;
  clientId: string;
  reportId: string;
  creditorName: string;
  maskedAccountId: string;
  fingerprint?: string;
  cra: CRA;
  accountType?: string;
  accountStatus: AccountStatus;
  balance?: number;
  pastDue?: number;
  creditLimit?: number;
  highBalance?: number;
  monthlyPayment?: number;
  dateOpened?: string;
  dateReported?: string;
  lastActivityDate?: string;
  paymentStatus?: string;
  disputeComment?: string;
  confidenceScore: number;
  isNegative: boolean;
  isDisputing: boolean;
  assignedFlow?: FlowType;
  currentRound?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientReport {
  id: string;
  clientId: string;
  cra: CRA;
  reportDate: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  parseStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  accountsFound: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEvent {
  id: string;
  clientId: string;
  eventType: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  userId?: string;
  user?: {
    name: string;
    email: string;
  };
}

export interface ClientListParams {
  search?: string;
  stage?: string;
  priority?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ClientListResponse {
  clients: Client[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateClientData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  ssn4?: string;
  dateOfBirth?: string;
  notes?: string;
}

export interface UpdateClientData extends Partial<CreateClientData> {
  stage?: string;
  priority?: string;
}

// ============================================================================
// useClients Hook
// Fetch list of clients with filtering and pagination
// ============================================================================

export function useClients(params: ClientListParams = {}) {
  const debouncedSearch = useDebounce(params.search || '', 300);

  const queryParams = useMemo(() => ({
    ...params,
    search: debouncedSearch || undefined,
  }), [params, debouncedSearch]);

  return useApiQuery<ClientListResponse>(
    () => clientsApi.list<ClientListResponse>(queryParams),
    [JSON.stringify(queryParams)]
  );
}

// ============================================================================
// useClient Hook
// Fetch single client by ID
// ============================================================================

export function useClient(id: string | null | undefined) {
  return useApiQuery<Client>(
    () => clientsApi.get<Client>(id!),
    [id],
    { enabled: !!id }
  );
}

// ============================================================================
// useClientAccounts Hook
// Fetch client's accounts from credit reports
// ============================================================================

export interface AccountsParams {
  cra?: CRA;
  status?: AccountStatus;
  isNegative?: boolean;
  isDisputing?: boolean;
}

export function useClientAccounts(clientId: string | null | undefined, params: AccountsParams = {}) {
  const queryParams = useMemo(() => ({
    cra: params.cra,
    status: params.status,
    isNegative: params.isNegative,
    isDisputing: params.isDisputing,
  }), [params]);

  return useApiQuery<ClientAccount[]>(
    () => clientsApi.getAccounts<ClientAccount[]>(clientId!, queryParams),
    [clientId, JSON.stringify(queryParams)],
    { enabled: !!clientId }
  );
}

// ============================================================================
// useClientNegativeAccounts Hook
// Fetch client's negative/derogatory accounts
// ============================================================================

export function useClientNegativeAccounts(clientId: string | null | undefined) {
  return useApiQuery<ClientAccount[]>(
    () => clientsApi.getNegativeAccounts<ClientAccount[]>(clientId!),
    [clientId],
    { enabled: !!clientId }
  );
}

// ============================================================================
// useClientReports Hook
// Fetch client's credit reports
// ============================================================================

export function useClientReports(clientId: string | null | undefined) {
  return useApiQuery<ClientReport[]>(
    () => clientsApi.getReports<ClientReport[]>(clientId!),
    [clientId],
    { enabled: !!clientId }
  );
}

// ============================================================================
// useClientDisputes Hook
// Fetch client's disputes
// ============================================================================

export function useClientDisputes(clientId: string | null | undefined) {
  return useApiQuery(
    () => clientsApi.getDisputes(clientId!),
    [clientId],
    { enabled: !!clientId }
  );
}

// ============================================================================
// useClientTimeline Hook
// Fetch client's activity timeline
// ============================================================================

export function useClientTimeline(clientId: string | null | undefined) {
  return useApiQuery<TimelineEvent[]>(
    () => clientsApi.getTimeline<TimelineEvent[]>(clientId!),
    [clientId],
    { enabled: !!clientId }
  );
}

// ============================================================================
// useArchivedClients Hook
// Fetch archived clients
// ============================================================================

export function useArchivedClients(params: ClientListParams = {}) {
  const debouncedSearch = useDebounce(params.search || '', 300);

  const queryParams = useMemo(() => ({
    ...params,
    search: debouncedSearch || undefined,
  }), [params, debouncedSearch]);

  return useApiQuery<ClientListResponse>(
    () => clientsApi.getArchived<ClientListResponse>(queryParams),
    [JSON.stringify(queryParams)]
  );
}

// ============================================================================
// Mutation Hooks
// ============================================================================

// Create Client
export function useCreateClient() {
  return useMutation<Client, CreateClientData>(
    (data) => clientsApi.create<Client>(data)
  );
}

// Update Client
export function useUpdateClient() {
  return useMutation<Client, { id: string; data: UpdateClientData }>(
    ({ id, data }) => clientsApi.update<Client>(id, data)
  );
}

// Delete Client
export function useDeleteClient() {
  return useMutation<void, string>(
    (id) => clientsApi.delete<void>(id)
  );
}

// Update Client Stage
export function useUpdateClientStage() {
  return useMutation<Client, { id: string; stage: string }>(
    ({ id, stage }) => clientsApi.updateStage<Client>(id, stage)
  );
}

// Update Client Priority
export function useUpdateClientPriority() {
  return useMutation<Client, { id: string; priority: string }>(
    ({ id, priority }) => clientsApi.updatePriority<Client>(id, priority)
  );
}

// Archive Client
export function useArchiveClient() {
  return useMutation<Client, string>(
    (id) => clientsApi.archive<Client>(id)
  );
}

// Restore Archived Client
export function useRestoreClient() {
  return useMutation<Client, string>(
    (id) => clientsApi.restore<Client>(id)
  );
}

// Upload Credit Report
export function useUploadReport() {
  return useMutation<ClientReport, { clientId: string; file: File }>(
    ({ clientId, file }) => reportsApi.upload<ClientReport>(clientId, file)
  );
}

// ============================================================================
// Computed Hooks
// ============================================================================

// Get client full name
export function useClientFullName(client: Client | null | undefined): string {
  return useMemo(() => {
    if (!client) return '';
    return `${client.firstName} ${client.lastName}`.trim();
  }, [client]);
}

// Get client initials
export function useClientInitials(client: Client | null | undefined): string {
  return useMemo(() => {
    if (!client) return '';
    const first = client.firstName?.[0] || '';
    const last = client.lastName?.[0] || '';
    return `${first}${last}`.toUpperCase();
  }, [client]);
}

// Calculate average credit score
export function useAverageCreditScore(scores: CreditScores | null | undefined): number {
  return useMemo(() => {
    if (!scores) return 0;
    const values = [scores.experian, scores.equifax, scores.transunion]
      .filter((v): v is number => typeof v === 'number' && v > 0);
    if (values.length === 0) return 0;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }, [scores]);
}

// Group accounts by CRA
export function useAccountsByCRA(accounts: ClientAccount[] | null | undefined) {
  return useMemo(() => {
    if (!accounts) return { EXPERIAN: [], EQUIFAX: [], TRANSUNION: [] };

    return accounts.reduce(
      (acc, account) => {
        if (!acc[account.cra]) {
          acc[account.cra] = [];
        }
        acc[account.cra].push(account);
        return acc;
      },
      { EXPERIAN: [], EQUIFAX: [], TRANSUNION: [] } as Record<CRA, ClientAccount[]>
    );
  }, [accounts]);
}

// Group accounts by status
export function useAccountsByStatus(accounts: ClientAccount[] | null | undefined) {
  return useMemo(() => {
    if (!accounts) return {};

    return accounts.reduce(
      (acc, account) => {
        if (!acc[account.accountStatus]) {
          acc[account.accountStatus] = [];
        }
        acc[account.accountStatus].push(account);
        return acc;
      },
      {} as Record<AccountStatus, ClientAccount[]>
    );
  }, [accounts]);
}

// Filter negative accounts
export function useNegativeAccounts(accounts: ClientAccount[] | null | undefined) {
  return useMemo(() => {
    if (!accounts) return [];
    return accounts.filter((account) => account.isNegative);
  }, [accounts]);
}

// Calculate client stats
export function useClientStats(client: Client | null | undefined, accounts: ClientAccount[] | null | undefined) {
  return useMemo(() => {
    const totalAccounts = accounts?.length || client?._count?.accounts || 0;
    const negativeAccounts = accounts?.filter((a) => a.isNegative).length || 0;
    const disputingAccounts = accounts?.filter((a) => a.isDisputing).length || 0;
    const totalDisputes = client?._count?.disputes || 0;
    const totalReports = client?._count?.reports || 0;

    return {
      totalAccounts,
      negativeAccounts,
      disputingAccounts,
      totalDisputes,
      totalReports,
      negativePercentage: totalAccounts > 0 ? Math.round((negativeAccounts / totalAccounts) * 100) : 0,
    };
  }, [client, accounts]);
}

// ============================================================================
// Search Hook
// ============================================================================

export function useClientSearch(searchTerm: string) {
  const debouncedSearch = useDebounce(searchTerm, 300);

  return useApiQuery<ClientListResponse>(
    () => clientsApi.list<ClientListResponse>({ search: debouncedSearch, limit: 10 }),
    [debouncedSearch],
    { enabled: debouncedSearch.length >= 2 }
  );
}

export default useClients;
