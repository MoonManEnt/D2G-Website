import { z } from "zod";

// =============================================================================
// SHARED ENUMS & PRIMITIVES
// =============================================================================

const craEnum = z.enum(["TRANSUNION", "EXPERIAN", "EQUIFAX"]);
const flowEnum = z.enum(["ACCURACY", "COLLECTION", "CONSENT", "COMBO"]);
const disputeOutcomeEnum = z.enum([
  "DELETED",
  "VERIFIED",
  "UPDATED",
  "NO_RESPONSE",
  "STALL_LETTER",
]);
const citationTargetEnum = z.enum(["CRA", "FURNISHER", "COLLECTOR"]);
const teamRoleEnum = z.enum(["OWNER", "ADMIN", "SPECIALIST", "VIEWER"]);

/**
 * Unique account IDs array with duplicate detection
 * Prevents the same account from being added twice to a dispute
 */
const uniqueAccountIdsArray = z
  .array(z.string().uuid("Invalid account ID"))
  .min(1, "At least one account is required")
  .refine(
    (ids) => new Set(ids).size === ids.length,
    {
      message: "Duplicate account IDs detected. Each account can only be included once in a dispute.",
    }
  );

// =============================================================================
// DISPUTE CODE LOOKUP
// =============================================================================

/**
 * Validate and lookup dispute by human-readable code
 * Format: D2GO-YYYYMMDD-XXX (Disputes) or STY-YYYYMMDD-XXX (Sentry)
 */
export const disputeCodeLookupSchema = z.object({
  code: z.string().regex(
    /^(D2GO|STY)-\d{8}-\d{3}$/,
    "Invalid dispute code format. Expected: D2GO-YYYYMMDD-XXX or STY-YYYYMMDD-XXX"
  ),
});

// =============================================================================
// AUTH SCHEMAS
// =============================================================================

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

// =============================================================================
// DISPUTE SCHEMAS
// =============================================================================

/**
 * POST /api/disputes - Create dispute with AMELIA letter generation
 */
export const createDisputeBodySchema = z.object({
  clientId: z.string().uuid("Invalid client ID"),
  cra: craEnum,
  flow: flowEnum,
  accountIds: uniqueAccountIdsArray,
  tone: z.string().optional(),
  letterStructure: z.enum(["FACTS_FIRST", "DAMAGES_FIRST"]).optional(),
});

/**
 * PATCH /api/disputes/[id] - Update dispute status
 */
export const updateDisputeSchema = z.object({
  status: z
    .enum(["DRAFT", "APPROVED", "SENT", "RESPONDED", "RESOLVED", "RESPONSE_RECEIVED"])
    .optional(),
  responseNotes: z.string().optional(),
  responseOutcome: z.string().optional(),
  letterContent: z.string().optional(),
  aiStrategy: z.string().optional(),
});

/**
 * POST /api/disputes/[id]/responses - Record a CRA response
 */
export const disputeResponseBodySchema = z.object({
  disputeItemId: z.string().uuid("Invalid dispute item ID"),
  outcome: disputeOutcomeEnum,
  responseDate: z.string().min(1, "Response date is required"),
  responseMethod: z.enum(["MAIL", "ONLINE", "FAX", "PHONE"]).default("MAIL"),
  stallTactic: z.string().optional().nullable(),
  stallDetails: z.string().optional().nullable(),
  updateType: z.string().optional().nullable(),
  previousValue: z.string().optional().nullable(),
  newValue: z.string().optional().nullable(),
  verificationMethod: z.string().optional().nullable(),
  furnisherResponse: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

/**
 * POST /api/disputes/ai - AI-powered dispute creation
 */
export const disputeAiSchema = z.object({
  clientId: z.string().uuid("Invalid client ID"),
  accountIds: uniqueAccountIdsArray,
  options: z
    .object({
      useAI: z.boolean().optional(),
      maxAccountsPerBatch: z.number().int().min(1).max(20).optional(),
      focusBureaus: z.array(craEnum).optional(),
      previewOnly: z.boolean().optional(),
    })
    .optional(),
});

/**
 * POST /api/disputes/preview - Generate AMELIA letter preview
 */
export const disputePreviewSchema = z.object({
  clientId: z.string().uuid("Invalid client ID"),
  cra: craEnum,
  flow: flowEnum,
  accountIds: uniqueAccountIdsArray,
});

/**
 * POST /api/disputes/create-and-launch - Create and launch dispute atomically
 */
export const disputeCreateAndLaunchSchema = z.object({
  clientId: z.string().uuid("Invalid client ID"),
  cra: craEnum,
  flow: flowEnum,
  accountIds: uniqueAccountIdsArray,
  letterContent: z.string().min(1, "Letter content is required"),
  contentHash: z.string().optional(),
});

// =============================================================================
// SENTRY SCHEMAS
// =============================================================================

// Writing mode enum for Sentry letters
// DEPRECATED: writingMode is ignored - all letters now use human-first style
const writingModeEnum = z.enum(["PROFESSIONAL", "NORMAL_PEOPLE"]).optional();

/**
 * POST /api/sentry - Create a new Sentry dispute
 */
export const sentryCreateSchema = z.object({
  clientId: z.string().uuid("Invalid client ID"),
  cra: craEnum,
  flow: flowEnum,
  accountIds: uniqueAccountIdsArray,
  generateLetter: z.boolean().default(true),
  eoscarCodeOverride: z.string().optional(),
  customLanguage: z.string().optional(),
  writingMode: writingModeEnum,
});

/**
 * POST /api/sentry/[id]/generate - Generate or regenerate letter
 */
export const sentryGenerateSchema = z.object({
  eoscarCodeOverride: z.string().optional(),
  customLanguage: z.string().optional(),
  templateId: z.string().optional(),
  writingMode: writingModeEnum,
});

/**
 * POST /api/sentry/[id]/launch - Launch (send) dispute
 */
export const sentryLaunchSchema = z.object({
  sentDate: z.string().optional(),
  trackingNumber: z.string().optional(),
  sentMethod: z.enum(["MAIL", "FAX", "ONLINE"]).optional(),
});

/**
 * POST /api/sentry/[id]/response - Record response
 */
export const sentryResponseSchema = z.object({
  outcomes: z
    .array(
      z.object({
        itemId: z.string().min(1, "Item ID is required"),
        outcome: disputeOutcomeEnum,
        notes: z.string().optional(),
      })
    )
    .min(1, "At least one outcome is required"),
  responseNotes: z.string().optional(),
  confirmationNumber: z.string().optional(),
});

/**
 * PATCH /api/sentry/[id]/response - Update response details
 */
export const sentryResponseUpdateSchema = z.object({
  itemId: z.string().min(1, "Item ID is required"),
  outcome: disputeOutcomeEnum.optional(),
  responseNotes: z.string().optional(),
});

/**
 * POST /api/sentry/recommend-codes - Get e-OSCAR code recommendations
 */
export const sentryRecommendCodesSchema = z.object({
  accountIds: uniqueAccountIdsArray,
  flow: flowEnum.default("ACCURACY"),
  includeAllCodes: z.boolean().default(false),
});

/**
 * POST /api/sentry/validate-citations - Validate legal citations
 */
export const sentryValidateCitationsSchema = z.object({
  text: z.string().min(1, "Text is required"),
  targetType: citationTargetEnum.default("CRA"),
  useCase: z.string().optional(),
});

/**
 * Shape of a SuccessPredictionRequest used for strategy comparison
 */
const successPredictionRequestSchema = z.object({
  accountAge: z.number(),
  furnisherName: z.string(),
  hasMetro2Targeting: z.boolean(),
  eoscarCode: z.string(),
  hasPoliceReport: z.boolean(),
  hasBureauDiscrepancy: z.boolean(),
  hasPaymentProof: z.boolean(),
  citationAccuracyScore: z.number().min(0).max(1),
  ocrSafetyScore: z.number().min(0).max(100),
});

/**
 * POST /api/sentry/success-prediction - Calculate success probability
 */
export const sentrySuccessPredictionSchema = z.object({
  // Full prediction fields
  accountAge: z.number().optional(),
  furnisherName: z.string().optional(),
  hasMetro2Targeting: z.boolean().optional(),
  eoscarCode: z.string().optional(),
  hasPoliceReport: z.boolean().optional(),
  hasBureauDiscrepancy: z.boolean().optional(),
  hasPaymentProof: z.boolean().optional(),
  citationAccuracyScore: z.number().min(0).max(1).optional(),
  ocrSafetyScore: z.number().min(0).max(100).optional(),
  // Quick estimate mode
  quickEstimateMode: z.boolean().optional(),
  hasSpecificCode: z.boolean().optional(),
  hasDocumentation: z.boolean().optional(),
  // Comparison mode
  compareMode: z.boolean().optional(),
  strategy1: successPredictionRequestSchema.optional(),
  strategy2: successPredictionRequestSchema.optional(),
});

/**
 * POST /api/sentry/analyze-letter - Analyze any letter text
 */
export const sentryAnalyzeLetterSchema = z.object({
  letterContent: z.string().min(100, "Letter content is too short for meaningful analysis"),
  targetType: citationTargetEnum.default("CRA"),
  applyFixes: z.boolean().default(false),
});

// =============================================================================
// EVIDENCE SCHEMAS
// =============================================================================

/**
 * POST /api/evidence/capture - Server-side PDF page extraction
 */
export const evidenceCaptureSchema = z.object({
  accountId: z.string().uuid("Invalid account ID"),
  reportId: z.string().uuid("Invalid report ID"),
});

/**
 * POST /api/evidence/upload - Upload client-captured screenshot
 */
export const evidenceUploadSchema = z.object({
  accountId: z.string().uuid("Invalid account ID"),
  reportId: z.string().uuid("Invalid report ID"),
  imageData: z.string().min(1, "Image data is required"),
  pageNumber: z.number().int().min(1, "Page number must be at least 1"),
  description: z.string().optional(),
});

// =============================================================================
// ORGANIZATION SCHEMAS
// =============================================================================

/**
 * PATCH /api/organization/branding - Update branding settings
 */
export const orgBrandingSchema = z.object({
  logoUrl: z.string().optional(),
  logoText: z.string().optional(),
  faviconUrl: z.string().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color format")
    .optional(),
  primaryHoverColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color format")
    .optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color format")
    .optional(),
  sidebarBgColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color format")
    .optional(),
  sidebarTextColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color format")
    .optional(),
  sidebarActiveColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color format")
    .optional(),
  companyName: z.string().optional(),
  companyAddress: z.string().optional(),
  companyPhone: z.string().optional(),
  companyEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  companyWebsite: z.string().url("Invalid URL").optional().or(z.literal("")),
  emailHeaderColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color format")
    .optional(),
  emailFooterText: z.string().optional(),
  customCss: z.string().optional(),
});

/**
 * POST /api/organization/reset - Reset all organization data
 */
export const orgResetSchema = z.object({
  confirmationPhrase: z.literal("DELETE ALL MY DATA", {
    errorMap: () => ({
      message: 'Confirmation phrase must be exactly "DELETE ALL MY DATA"',
    }),
  }),
});

// =============================================================================
// TEAM SCHEMAS
// =============================================================================

/**
 * POST /api/team - Invite a new team member
 */
export const teamMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required"),
  role: teamRoleEnum.default("SPECIALIST"),
});

/**
 * PATCH /api/team/[id] - Update a team member
 */
export const updateTeamMemberSchema = z.object({
  name: z.string().min(1).optional(),
  role: teamRoleEnum.optional(),
  isActive: z.boolean().optional(),
  profilePicture: z.string().optional().nullable(),
});

// =============================================================================
// BILLING SCHEMAS
// =============================================================================

/**
 * POST /api/billing/checkout - Create a checkout session
 */
export const checkoutSchema = z.object({
  plan: z.enum(["STARTER", "PROFESSIONAL"], {
    errorMap: () => ({ message: "Invalid plan selected. Must be STARTER or PROFESSIONAL." }),
  }),
  interval: z.enum(["monthly", "yearly"]).default("monthly"),
});

// =============================================================================
// NOTIFICATION SCHEMAS
// =============================================================================

/**
 * POST /api/notifications - Mark notifications as read
 */
export const notificationActionSchema = z.object({
  action: z.enum(["markRead", "markAllRead"]),
  notificationId: z.string().uuid("Invalid notification ID").optional(),
});

// =============================================================================
// DOCUMENT SCHEMAS
// =============================================================================

/**
 * PATCH /api/documents/[id] - Update document content
 */
export const updateDocumentSchema = z.object({
  content: z.string().optional(),
  approvalStatus: z
    .enum(["DRAFT", "APPROVED", "REJECTED", "REQUEST_CHANGES"])
    .optional(),
});

// =============================================================================
// FEEDBACK SCHEMA
// =============================================================================

/**
 * POST /api/feedback - Submit beta feedback
 */
export const feedbackSchema = z.object({
  type: z.string().min(1, "Type is required"),
  rating: z.number().min(1).max(5).optional().nullable(),
  comment: z.string().min(1, "Comment is required"),
  page: z.string().optional(),
  timestamp: z.string().optional(),
  userAgent: z.string().optional(),
  screenSize: z.string().optional(),
});

// =============================================================================
// USER SCHEMAS
// =============================================================================

/**
 * PATCH /api/user/profile - Update current user's profile
 */
export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .optional(),
});

/**
 * POST /api/user/password - Change password
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

// =============================================================================
// MAIL SENDING SCHEMAS
// =============================================================================

/**
 * POST /api/disputes/[id]/mail or /api/sentry/[id]/mail - Mail sending options
 */
export const mailSendSchema = z.object({
  provider: z.enum(["LOB", "DOCUPOST"]).default("DOCUPOST"),
  color: z.boolean().default(false),
  doubleSided: z.boolean().default(true),
  certified: z.boolean().default(false),
  returnReceipt: z.boolean().default(false),
});

// =============================================================================
// CREDIT READINESS SCHEMAS
// =============================================================================

/**
 * POST /api/credit-readiness - Analyze credit readiness
 */
export const creditReadinessSchema = z.object({
  productType: z.enum(["MORTGAGE", "AUTO", "CREDIT_CARD", "PERSONAL_LOAN", "BUSINESS_LOC", "GENERAL"]),
  statedIncome: z.number().positive().optional(),
  incomeType: z.enum(["SALARY", "HOURLY", "SELF_EMPLOYED", "RETIREMENT", "OTHER"]).optional(),
  reasonForApplying: z.string().max(500).optional(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type MailSendInput = z.infer<typeof mailSendSchema>;
export type CreditReadinessInput = z.infer<typeof creditReadinessSchema>;
export type DisputeCodeLookupInput = z.infer<typeof disputeCodeLookupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type CreateDisputeBodyInput = z.infer<typeof createDisputeBodySchema>;
export type UpdateDisputeInput = z.infer<typeof updateDisputeSchema>;
export type DisputeResponseBodyInput = z.infer<typeof disputeResponseBodySchema>;
export type DisputeAiInput = z.infer<typeof disputeAiSchema>;
export type DisputePreviewInput = z.infer<typeof disputePreviewSchema>;
export type DisputeCreateAndLaunchInput = z.infer<typeof disputeCreateAndLaunchSchema>;
export type SentryCreateInput = z.infer<typeof sentryCreateSchema>;
export type SentryGenerateInput = z.infer<typeof sentryGenerateSchema>;
export type SentryLaunchInput = z.infer<typeof sentryLaunchSchema>;
export type SentryResponseInput = z.infer<typeof sentryResponseSchema>;
export type SentryResponseUpdateInput = z.infer<typeof sentryResponseUpdateSchema>;
export type SentryRecommendCodesInput = z.infer<typeof sentryRecommendCodesSchema>;
export type SentryValidateCitationsInput = z.infer<typeof sentryValidateCitationsSchema>;
export type SentrySuccessPredictionInput = z.infer<typeof sentrySuccessPredictionSchema>;
export type SentryAnalyzeLetterInput = z.infer<typeof sentryAnalyzeLetterSchema>;
export type EvidenceCaptureInput = z.infer<typeof evidenceCaptureSchema>;
export type EvidenceUploadInput = z.infer<typeof evidenceUploadSchema>;
export type OrgBrandingInput = z.infer<typeof orgBrandingSchema>;
export type OrgResetInput = z.infer<typeof orgResetSchema>;
export type TeamMemberInput = z.infer<typeof teamMemberSchema>;
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type NotificationActionInput = z.infer<typeof notificationActionSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// =============================================================================
// VENDOR SCHEMAS
// =============================================================================

const vendorCategoryEnum = z.enum([
  "CREDIT_REPAIR",
  "DEBT_MANAGEMENT",
  "FINANCIAL_COACHING",
  "CREDIT_MONITORING",
  "CREDIT_BUILDER",
  "OTHER",
]);

const commissionTypeEnum = z.enum(["FLAT", "PERCENTAGE", "TIERED"]);

/**
 * POST /api/vendors - Create a vendor
 */
export const createVendorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: vendorCategoryEnum,
  logoUrl: z.string().url("Invalid logo URL").optional().or(z.literal("")),
  websiteUrl: z.string().url("Invalid website URL").optional().or(z.literal("")),
  affiliateUrl: z.string().url("Invalid affiliate URL").optional().or(z.literal("")),
  affiliateCode: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Invalid contact email").optional().or(z.literal("")),
  isActive: z.boolean().default(true),
  commissionType: commissionTypeEnum.optional(),
  commissionValue: z.number().min(0).optional(),
});

/**
 * PATCH /api/vendors/[id] - Update a vendor
 */
export const updateVendorSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  category: vendorCategoryEnum.optional(),
  logoUrl: z.string().url("Invalid logo URL").optional().nullable().or(z.literal("")),
  websiteUrl: z.string().url("Invalid website URL").optional().nullable().or(z.literal("")),
  affiliateUrl: z.string().url("Invalid affiliate URL").optional().nullable().or(z.literal("")),
  affiliateCode: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactEmail: z.string().email("Invalid contact email").optional().nullable().or(z.literal("")),
  isActive: z.boolean().optional(),
  commissionType: commissionTypeEnum.optional().nullable(),
  commissionValue: z.number().min(0).optional().nullable(),
});

// =============================================================================
// VENDOR RULE SCHEMAS
// =============================================================================

const ruleConditionFieldEnum = z.enum([
  "credit_score_min",
  "credit_score_max",
  "credit_score_avg",
  "has_collections",
  "collection_count_min",
  "collection_balance_min",
  "has_charge_offs",
  "charge_off_count_min",
  "total_debt_min",
  "total_debt_max",
  "account_count_min",
  "account_count_max",
  "dispute_stage",
  "dna_classification",
  "health_score_min",
  "health_score_max",
  "improvement_potential_min",
  "utilization_min",
  "utilization_max",
  "has_income",
  "income_min",
  "income_max",
  "readiness_product_type",
  "approval_likelihood_max",
  "inquiry_count_min",
]);

const ruleConditionOperatorEnum = z.enum([
  "equals",
  "not_equals",
  "greater_than",
  "less_than",
  "in",
  "not_in",
  "between",
]);

const ruleConditionSchema = z.object({
  field: ruleConditionFieldEnum,
  operator: ruleConditionOperatorEnum,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  valueEnd: z.number().optional(),
});

/**
 * POST /api/vendors/[id]/rules - Create a vendor rule
 */
export const createVendorRuleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  priority: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  conditions: z.array(ruleConditionSchema).min(1, "At least one condition is required"),
  recommendationTitle: z.string().min(1, "Recommendation title is required"),
  recommendationBody: z.string().min(1, "Recommendation body is required"),
  recommendationCTA: z.string().optional(),
  customAffiliateUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
});

/**
 * PATCH /api/vendors/[id]/rules/[ruleId] - Update a vendor rule
 */
export const updateVendorRuleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  priority: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  conditions: z.array(ruleConditionSchema).min(1).optional(),
  recommendationTitle: z.string().min(1).optional(),
  recommendationBody: z.string().min(1).optional(),
  recommendationCTA: z.string().optional().nullable(),
  customAffiliateUrl: z.string().url("Invalid URL").optional().nullable().or(z.literal("")),
});

// =============================================================================
// REFERRAL SCHEMAS
// =============================================================================

const referralTriggerTypeEnum = z.enum([
  "READINESS_ANALYSIS",
  "ACTION_PLAN",
  "MANUAL",
  "PORTAL_VIEW",
]);

/**
 * POST /api/referrals - Track a referral
 */
export const trackReferralSchema = z.object({
  vendorId: z.string().uuid("Invalid vendor ID"),
  clientId: z.string().uuid("Invalid client ID"),
  triggerType: referralTriggerTypeEnum,
  triggerEntityId: z.string().optional(),
  ruleId: z.string().uuid("Invalid rule ID").optional(),
  affiliateUrl: z.string().url("Invalid affiliate URL").optional(),
});

// =============================================================================
// VENDOR TYPE EXPORTS
// =============================================================================

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
export type CreateVendorRuleInput = z.infer<typeof createVendorRuleSchema>;
export type UpdateVendorRuleInput = z.infer<typeof updateVendorRuleSchema>;
export type TrackReferralInput = z.infer<typeof trackReferralSchema>;

// =============================================================================
// LITIGATION SCANNER SCHEMAS
// =============================================================================

/**
 * POST /api/clients/[id]/litigation-scan - Run a new litigation scan
 */
export const litigationScanSchema = z.object({
  clientState: z.string().length(2, "State must be a 2-letter code").optional(),
});

export type LitigationScanInput = z.infer<typeof litigationScanSchema>;
