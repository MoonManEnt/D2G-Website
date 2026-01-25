'use client';

// ============================================================================
// DISPUTE2GO - Dispute Hooks
// React hooks for dispute-related API operations
// ============================================================================

import { useMemo } from 'react';
import { useApiQuery, useMutation, useDebounce } from './use-api';
import { disputesApi, lettersApi } from '@/lib/api-client';
import type { CRA, FlowType, DisputeStatus, DocumentType } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface Dispute {
  id: string;
  clientId: string;
  accountId: string;
  cra: CRA;
  flow: FlowType;
  round: number;
  status: DisputeStatus;
  letterContent?: string;
  statuteCited?: string;
  sentDate?: string;
  responseDate?: string;
  responseType?: 'DELETED' | 'VERIFIED' | 'UPDATED' | 'PENDING' | 'NO_RESPONSE';
  responseNotes?: string;
  trackingNumber?: string;
  certifiedMailNumber?: string;
  deadlineDate?: string;
  escalatedReason?: string;
  createdAt: string;
  updatedAt: string;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  account?: {
    id: string;
    creditorName: string;
    maskedAccountId: string;
    balance?: number;
    accountStatus: string;
  };
  documents?: DisputeDocument[];
}

export interface DisputeDocument {
  id: string;
  disputeId: string;
  documentType: DocumentType;
  content: string;
  approvalStatus: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface DisputeLetter {
  id: string;
  disputeId: string;
  content: string;
  sections?: LetterSection[];
  statutesCited: string[];
  version: number;
  createdAt: string;
}

export interface LetterSection {
  type: string;
  content: string;
}

export interface DisputeListParams {
  clientId?: string;
  status?: DisputeStatus;
  cra?: CRA;
  flow?: FlowType;
  round?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface DisputeListResponse {
  disputes: Dispute[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PendingResponse {
  dispute: Dispute;
  daysRemaining: number;
  deadlineDate: string;
  isOverdue: boolean;
}

export interface DisputeNeedingAction {
  dispute: Dispute;
  actionRequired: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
}

export interface CreateDisputeData {
  clientId: string;
  accountId: string;
  cra: CRA;
  flow: FlowType;
  round?: number;
  statuteCited?: string;
  letterContent?: string;
}

export interface UpdateDisputeData {
  status?: DisputeStatus;
  letterContent?: string;
  statuteCited?: string;
  sentDate?: string;
  trackingNumber?: string;
  certifiedMailNumber?: string;
  responseDate?: string;
  responseType?: 'DELETED' | 'VERIFIED' | 'UPDATED' | 'PENDING' | 'NO_RESPONSE';
  responseNotes?: string;
  escalatedReason?: string;
}

export interface LogResponseData {
  responseDate: string;
  responseType: 'DELETED' | 'VERIFIED' | 'UPDATED' | 'PENDING' | 'NO_RESPONSE';
  responseNotes?: string;
}

export interface MarkSentData {
  sentDate: string;
  trackingNumber?: string;
  certifiedMailNumber?: string;
}

export interface RegenerateLetterOptions {
  tone?: 'formal' | 'assertive' | 'aggressive';
  includeLegalCitations?: boolean;
  customInstructions?: string;
  [key: string]: string | boolean | undefined;
}

// ============================================================================
// useDisputes Hook
// Fetch list of disputes with filtering and pagination
// ============================================================================

export function useDisputes(params: DisputeListParams = {}) {
  const debouncedSearch = useDebounce(params.search || '', 300);

  const queryParams = useMemo(() => ({
    ...params,
    search: debouncedSearch || undefined,
  }), [params, debouncedSearch]);

  return useApiQuery<DisputeListResponse>(
    () => disputesApi.list<DisputeListResponse>(queryParams),
    [JSON.stringify(queryParams)]
  );
}

// ============================================================================
// useDispute Hook
// Fetch single dispute by ID
// ============================================================================

export function useDispute(id: string | null | undefined) {
  return useApiQuery<Dispute>(
    () => disputesApi.get<Dispute>(id!),
    [id],
    { enabled: !!id }
  );
}

// ============================================================================
// useDisputeLetter Hook
// Fetch dispute letter content
// ============================================================================

export function useDisputeLetter(disputeId: string | null | undefined) {
  return useApiQuery<DisputeLetter>(
    () => disputesApi.getLetter<DisputeLetter>(disputeId!),
    [disputeId],
    { enabled: !!disputeId }
  );
}

// ============================================================================
// usePendingResponses Hook
// Fetch disputes awaiting CRA responses
// ============================================================================

export function usePendingResponses() {
  return useApiQuery<PendingResponse[]>(
    () => disputesApi.getPendingResponses<PendingResponse[]>(),
    []
  );
}

// ============================================================================
// useDisputesNeedingAction Hook
// Fetch disputes that need attention
// ============================================================================

export function useDisputesNeedingAction() {
  return useApiQuery<DisputeNeedingAction[]>(
    () => disputesApi.getNeedingAction<DisputeNeedingAction[]>(),
    []
  );
}

// ============================================================================
// useClientDisputes Hook
// Fetch disputes for a specific client
// ============================================================================

export function useClientDisputesList(clientId: string | null | undefined, params: Omit<DisputeListParams, 'clientId'> = {}) {
  const queryParams = useMemo(() => ({
    ...params,
    clientId: clientId || undefined,
  }), [clientId, params]);

  return useApiQuery<DisputeListResponse>(
    () => disputesApi.list<DisputeListResponse>(queryParams),
    [JSON.stringify(queryParams)],
    { enabled: !!clientId }
  );
}

// ============================================================================
// useDisputesByStatus Hook
// Fetch disputes filtered by status
// ============================================================================

export function useDisputesByStatus(status: DisputeStatus) {
  return useApiQuery<DisputeListResponse>(
    () => disputesApi.list<DisputeListResponse>({ status }),
    [status]
  );
}

// ============================================================================
// useDisputesByCRA Hook
// Fetch disputes filtered by CRA
// ============================================================================

export function useDisputesByCRA(cra: CRA) {
  return useApiQuery<DisputeListResponse>(
    () => disputesApi.list<DisputeListResponse>({ cra }),
    [cra]
  );
}

// ============================================================================
// Letter Preview Hook
// ============================================================================

export function useLetterPreview(disputeId: string | null | undefined) {
  return useApiQuery<{ html: string; plainText: string }>(
    () => lettersApi.preview<{ html: string; plainText: string }>(disputeId!),
    [disputeId],
    { enabled: !!disputeId }
  );
}

// ============================================================================
// Mutation Hooks
// ============================================================================

// Create Dispute
export function useCreateDispute() {
  return useMutation<Dispute, CreateDisputeData>(
    (data) => disputesApi.create<Dispute>(data)
  );
}

// Update Dispute
export function useUpdateDispute() {
  return useMutation<Dispute, { id: string; data: UpdateDisputeData }>(
    ({ id, data }) => disputesApi.update<Dispute>(id, data)
  );
}

// Delete Dispute
export function useDeleteDispute() {
  return useMutation<void, string>(
    (id) => disputesApi.delete<void>(id)
  );
}

// Approve Dispute
export function useApproveDispute() {
  return useMutation<Dispute, string>(
    (id) => disputesApi.approve<Dispute>(id)
  );
}

// Mark Dispute as Sent
export function useMarkDisputeSent() {
  return useMutation<Dispute, { disputeId: string; data: MarkSentData }>(
    ({ disputeId, data }) => disputesApi.markSent<Dispute>(disputeId, data)
  );
}

// Log CRA Response
export function useLogResponse() {
  return useMutation<Dispute, { disputeId: string; data: LogResponseData }>(
    ({ disputeId, data }) => disputesApi.logResponse<Dispute>(disputeId, data)
  );
}

// Update Letter Content
export function useUpdateLetter() {
  return useMutation<DisputeLetter, { disputeId: string; content: string }>(
    ({ disputeId, content }) => disputesApi.updateLetter<DisputeLetter>(disputeId, content)
  );
}

// Regenerate Letter with AI
export function useRegenerateLetter() {
  return useMutation<DisputeLetter, { disputeId: string; options?: RegenerateLetterOptions }>(
    ({ disputeId, options }) => disputesApi.regenerateLetter<DisputeLetter>(disputeId, options)
  );
}

// Download Letter as DOCX
export function useDownloadDocx() {
  return useMutation<Blob, string>(
    (disputeId) => disputesApi.generateDocx(disputeId)
  );
}

// Download Letter as PDF
export function useDownloadPdf() {
  return useMutation<Blob, string>(
    (disputeId) => disputesApi.generatePdf(disputeId)
  );
}

// Bulk Operations
export function useBulkUpdateDisputes() {
  return useMutation<Dispute[], { ids: string[]; data: UpdateDisputeData }>(
    ({ ids, data }) => disputesApi.getBulk<Dispute[]>(ids).then(() =>
      Promise.all(ids.map(id => disputesApi.update<Dispute>(id, data)))
    )
  );
}

// ============================================================================
// Computed Hooks
// ============================================================================

// Calculate days until response deadline
export function useDaysUntilDeadline(sentDate: string | null | undefined, days: number = 30): number {
  return useMemo(() => {
    if (!sentDate) return -1;
    const sent = new Date(sentDate);
    const deadline = new Date(sent);
    deadline.setDate(deadline.getDate() + days);
    const now = new Date();
    const diff = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }, [sentDate, days]);
}

// Check if dispute is overdue
export function useIsOverdue(sentDate: string | null | undefined, days: number = 30): boolean {
  const daysRemaining = useDaysUntilDeadline(sentDate, days);
  return daysRemaining < 0;
}

// Group disputes by status
export function useDisputesByStatusGroup(disputes: Dispute[] | null | undefined) {
  return useMemo(() => {
    if (!disputes) return {};

    return disputes.reduce(
      (acc, dispute) => {
        if (!acc[dispute.status]) {
          acc[dispute.status] = [];
        }
        acc[dispute.status].push(dispute);
        return acc;
      },
      {} as Record<DisputeStatus, Dispute[]>
    );
  }, [disputes]);
}

// Group disputes by CRA
export function useDisputesByCRAGroup(disputes: Dispute[] | null | undefined) {
  return useMemo(() => {
    if (!disputes) return { EXPERIAN: [], EQUIFAX: [], TRANSUNION: [] };

    return disputes.reduce(
      (acc, dispute) => {
        if (!acc[dispute.cra]) {
          acc[dispute.cra] = [];
        }
        acc[dispute.cra].push(dispute);
        return acc;
      },
      { EXPERIAN: [], EQUIFAX: [], TRANSUNION: [] } as Record<CRA, Dispute[]>
    );
  }, [disputes]);
}

// Group disputes by flow
export function useDisputesByFlowGroup(disputes: Dispute[] | null | undefined) {
  return useMemo(() => {
    if (!disputes) return {};

    return disputes.reduce(
      (acc, dispute) => {
        if (!acc[dispute.flow]) {
          acc[dispute.flow] = [];
        }
        acc[dispute.flow].push(dispute);
        return acc;
      },
      {} as Record<FlowType, Dispute[]>
    );
  }, [disputes]);
}

// Calculate dispute statistics
export function useDisputeStats(disputes: Dispute[] | null | undefined) {
  return useMemo(() => {
    if (!disputes || disputes.length === 0) {
      return {
        total: 0,
        draft: 0,
        pending: 0,
        sent: 0,
        responded: 0,
        resolved: 0,
        escalated: 0,
        successRate: 0,
        averageRound: 0,
      };
    }

    const draft = disputes.filter(d => d.status === 'DRAFT').length;
    const pending = disputes.filter(d => d.status === 'PENDING_REVIEW').length;
    const sent = disputes.filter(d => d.status === 'SENT').length;
    const responded = disputes.filter(d => d.status === 'RESPONDED').length;
    const resolved = disputes.filter(d => d.status === 'RESOLVED').length;
    const escalated = disputes.filter(d => d.status === 'ESCALATED').length;

    const successfulDisputes = disputes.filter(
      d => d.status === 'RESOLVED' && d.responseType === 'DELETED'
    ).length;

    const completedDisputes = disputes.filter(
      d => d.status === 'RESOLVED' || d.status === 'ESCALATED'
    ).length;

    const successRate = completedDisputes > 0
      ? Math.round((successfulDisputes / completedDisputes) * 100)
      : 0;

    const averageRound = disputes.length > 0
      ? Math.round(disputes.reduce((sum, d) => sum + d.round, 0) / disputes.length * 10) / 10
      : 0;

    return {
      total: disputes.length,
      draft,
      pending,
      sent,
      responded,
      resolved,
      escalated,
      successRate,
      averageRound,
    };
  }, [disputes]);
}

// Filter pending responses that are overdue
export function useOverdueResponses(pendingResponses: PendingResponse[] | null | undefined) {
  return useMemo(() => {
    if (!pendingResponses) return [];
    return pendingResponses.filter(pr => pr.isOverdue);
  }, [pendingResponses]);
}

// Sort disputes by priority/urgency
export function useSortedDisputesByUrgency(disputes: Dispute[] | null | undefined) {
  return useMemo(() => {
    if (!disputes) return [];

    return [...disputes].sort((a, b) => {
      // Status priority: PENDING_REVIEW > SENT > RESPONDED > DRAFT > RESOLVED > ESCALATED
      const statusPriority: Record<DisputeStatus, number> = {
        PENDING_REVIEW: 1,
        SENT: 2,
        RESPONDED: 3,
        DRAFT: 4,
        APPROVED: 5,
        RESOLVED: 6,
        ESCALATED: 7,
      };

      const aPriority = statusPriority[a.status] || 99;
      const bPriority = statusPriority[b.status] || 99;

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // If same status, sort by round (higher round = more urgent)
      if (a.round !== b.round) {
        return b.round - a.round;
      }

      // If same round, sort by created date (older = more urgent)
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [disputes]);
}

export default useDisputes;
