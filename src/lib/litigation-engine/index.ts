/**
 * Litigation Workflow Engine — Barrel Exports
 */

// Types
export * from "./types";

// Jurisdiction
export {
  resolveJurisdiction,
  recommendCourtType,
  getFilingFeeEstimate,
  getServiceRequirements,
  getStateAGAddress,
  getFTCComplaintInfo,
} from "./jurisdiction-resolver";

// Case Management
export {
  createCase,
  advanceToNextStage,
  updateCaseStatus,
  getCaseWithFullData,
} from "./case-manager";

// Document Generation
export {
  generateLitigationDocument,
  regenerateDocument,
} from "./document-generator";

// Document Templates
export {
  getDocumentTemplate,
  buildDocumentPrompt,
  AI_DISCLAIMER,
  DOCUMENT_TEMPLATES,
} from "./document-templates";
