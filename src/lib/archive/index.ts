/**
 * Archive Module
 *
 * Comprehensive client archival system with 90-day retention,
 * AMELIA integration for re-engagement, and compliance tracking.
 */

export * from "./types";
export { ArchiveService } from "./archive-service";
export {
  generateAmeliaContext,
  determineRecommendedAction,
  getUnresolvedCRAs,
  generateDisputeStrategySummary,
  generateCreditProfileSummary,
  generateComplianceAuditTrail,
  generatePersonalizedMessage,
} from "./amelia-integration";
