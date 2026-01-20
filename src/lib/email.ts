import { Resend } from "resend";
import {
  portalInviteTemplate,
  disputeCreatedTemplate,
  disputeStatusUpdateTemplate,
  deadlineReminderTemplate,
  scoreChangeTemplate,
  passwordResetTemplate,
  welcomeTemplate,
  documentReadyTemplate,
  BrandingConfig,
} from "./email-templates";

// Initialize Resend client
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@dispute2go.com";
const REPLY_TO = process.env.EMAIL_REPLY_TO || "support@dispute2go.com";
const APP_URL = process.env.APP_URL || "http://localhost:3000";
const PORTAL_URL = process.env.PORTAL_URL || `${APP_URL}/portal`;

// Email templates
interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Get branding config for an organization
async function getOrganizationBranding(
  organizationId?: string
): Promise<Partial<BrandingConfig> | undefined> {
  if (!organizationId) return undefined;

  // TODO: Fetch organization branding from database
  // For now, return default branding
  return {
    companyName: process.env.DEFAULT_COMPANY_NAME || "Dispute2Go",
    primaryColor: "#7c3aed",
    supportEmail: process.env.DEFAULT_SUPPORT_EMAIL || "support@dispute2go.com",
    websiteUrl: APP_URL,
  };
}

// Strip HTML for plain text version
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&bull;/g, "•")
    .replace(/&rarr;/g, "→")
    .replace(/&copy;/g, "©")
    .trim();
}

// =============================================================================
// EMAIL TEMPLATE GENERATORS
// =============================================================================

// Portal Invite Email
export function portalInviteEmail(
  clientName: string,
  organizationName: string,
  inviteToken: string,
  branding?: Partial<BrandingConfig>
): EmailTemplate {
  const inviteUrl = `${PORTAL_URL}/invite?token=${inviteToken}`;
  const html = portalInviteTemplate(
    { clientName, organizationName, inviteUrl },
    { branding }
  );

  return {
    subject: `You're invited to access your client portal - ${organizationName}`,
    html,
    text: `Hi ${clientName},\n\nYou've been invited to access your client portal at ${organizationName}.\n\nActivate your account: ${inviteUrl}\n\nThis invitation link will expire in 7 days.\n\nIf you didn't expect this email, please contact ${organizationName}.`,
  };
}

// Dispute Created Email
export function disputeCreatedEmail(
  clientName: string,
  cra: string,
  accountCount: number,
  disputeId: string,
  branding?: Partial<BrandingConfig>
): EmailTemplate {
  const portalUrl = `${PORTAL_URL}/disputes/${disputeId}`;
  const html = disputeCreatedTemplate(
    { clientName, cra, accountCount, disputeId, portalUrl },
    { branding }
  );

  return {
    subject: `New dispute created with ${cra}`,
    html,
    text: `Hi ${clientName},\n\nA new dispute has been created on your behalf.\n\nCredit Bureau: ${cra}\nAccounts Included: ${accountCount}\nDispute ID: ${disputeId.slice(0, 8).toUpperCase()}\n\nView details: ${portalUrl}`,
  };
}

// Dispute Status Update Email
export function disputeStatusUpdateEmail(
  clientName: string,
  cra: string,
  oldStatus: string,
  newStatus: string,
  statusMessage: string,
  disputeId: string,
  branding?: Partial<BrandingConfig>
): EmailTemplate {
  const portalUrl = `${PORTAL_URL}/disputes/${disputeId}`;
  const html = disputeStatusUpdateTemplate(
    { clientName, cra, oldStatus, newStatus, statusMessage, portalUrl },
    { branding }
  );

  return {
    subject: `Dispute update: ${newStatus.replace(/_/g, " ")} - ${cra}`,
    html,
    text: `Hi ${clientName},\n\nYour ${cra} dispute has been updated.\n\nStatus changed from ${oldStatus.replace(/_/g, " ")} to ${newStatus.replace(/_/g, " ")}.\n\n${statusMessage}\n\nView details: ${portalUrl}`,
  };
}

// Deadline Reminder Email
export function deadlineReminderEmail(
  clientName: string,
  cra: string,
  daysRemaining: number,
  sentDate: string,
  deadlineDate: string,
  disputeId: string,
  branding?: Partial<BrandingConfig>
): EmailTemplate {
  const portalUrl = `${PORTAL_URL}/disputes/${disputeId}`;
  const html = deadlineReminderTemplate(
    { clientName, cra, daysRemaining, sentDate, deadlineDate, portalUrl },
    { branding }
  );

  return {
    subject: `${daysRemaining} days until ${cra} dispute deadline`,
    html,
    text: `Hi ${clientName},\n\nYour dispute with ${cra} is approaching its response deadline.\n\nDays Remaining: ${daysRemaining}\nDispute Sent: ${sentDate}\nResponse Deadline: ${deadlineDate}\n\nUnder the FCRA, credit bureaus must respond within 30 days.\n\nView status: ${portalUrl}`,
  };
}

// Score Change Email
export function scoreChangeEmail(
  clientName: string,
  cra: string,
  oldScore: number,
  newScore: number,
  changeAmount: number,
  branding?: Partial<BrandingConfig>
): EmailTemplate {
  const portalUrl = `${PORTAL_URL}/scores`;
  const html = scoreChangeTemplate(
    { clientName, cra, oldScore, newScore, changeAmount, portalUrl },
    { branding }
  );

  const direction = changeAmount > 0 ? "increased" : "decreased";

  return {
    subject: `Your ${cra} credit score ${direction} by ${Math.abs(changeAmount)} points`,
    html,
    text: `Hi ${clientName},\n\nYour ${cra} credit score has changed.\n\nPrevious Score: ${oldScore}\nNew Score: ${newScore}\nChange: ${changeAmount > 0 ? "+" : ""}${changeAmount} points\n\nView full report: ${portalUrl}`,
  };
}

// Password Reset Email
export function passwordResetEmail(
  userName: string,
  resetToken: string,
  expiresIn: string = "1 hour",
  branding?: Partial<BrandingConfig>
): EmailTemplate {
  const resetUrl = `${APP_URL}/auth/reset-password?token=${resetToken}`;
  const html = passwordResetTemplate(
    { userName, resetUrl, expiresIn },
    { branding }
  );

  return {
    subject: "Reset your password",
    html,
    text: `Hi ${userName},\n\nWe received a request to reset your password.\n\nReset your password: ${resetUrl}\n\nThis link will expire in ${expiresIn}.\n\nIf you didn't request a password reset, you can safely ignore this email.`,
  };
}

// Welcome Email
export function welcomeEmail(
  userName: string,
  organizationName: string,
  branding?: Partial<BrandingConfig>
): EmailTemplate {
  const loginUrl = `${APP_URL}/auth/login`;
  const html = welcomeTemplate(
    { userName, organizationName, loginUrl },
    { branding }
  );

  return {
    subject: `Welcome to ${organizationName}!`,
    html,
    text: `Hi ${userName},\n\nWelcome to ${organizationName}! Your account has been created successfully.\n\nGetting Started:\n1. Upload your credit report (IdentityIQ or similar)\n2. Review identified negative items\n3. Create and send disputes\n4. Track your progress\n\nLogin to your dashboard: ${loginUrl}`,
  };
}

// Document Ready Email
export function documentReadyEmail(
  clientName: string,
  documentType: string,
  documentTitle: string,
  documentId: string,
  branding?: Partial<BrandingConfig>
): EmailTemplate {
  const portalUrl = `${PORTAL_URL}/documents/${documentId}`;
  const html = documentReadyTemplate(
    { clientName, documentType, documentTitle, portalUrl },
    { branding }
  );

  return {
    subject: `New ${documentType} ready for review`,
    html,
    text: `Hi ${clientName},\n\nA new document has been prepared and is ready for your review.\n\nDocument Type: ${documentType}\nTitle: ${documentTitle}\n\nView document: ${portalUrl}`,
  };
}

// =============================================================================
// SEND EMAIL FUNCTION
// =============================================================================

export interface SendEmailOptions {
  to: string | string[];
  template: EmailTemplate;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export async function sendEmail(
  options: SendEmailOptions
): Promise<{ success: boolean; error?: string; id?: string }> {
  const { to, template, replyTo = REPLY_TO, tags } = options;

  if (!resend) {
    console.warn("Email not configured: RESEND_API_KEY not set");
    // In development, log the email instead
    if (process.env.NODE_ENV === "development") {
      console.log("--- Email Preview ---");
      console.log("To:", to);
      console.log("Subject:", template.subject);
      console.log("Preview:", template.text.slice(0, 200) + "...");
      console.log("---");
    }
    return { success: false, error: "Email service not configured" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      replyTo,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags,
    });

    if (error) {
      console.error("Email send error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Email send exception:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

export async function sendPortalInviteEmail(
  to: string,
  clientName: string,
  organizationName: string,
  inviteToken: string,
  organizationId?: string
): Promise<{ success: boolean; error?: string; id?: string }> {
  const branding = await getOrganizationBranding(organizationId);
  const template = portalInviteEmail(clientName, organizationName, inviteToken, branding);
  return sendEmail({
    to,
    template,
    tags: [
      { name: "category", value: "portal-invite" },
      { name: "organization", value: organizationId || "default" },
    ],
  });
}

export async function sendDisputeCreatedEmail(
  to: string,
  clientName: string,
  cra: string,
  accountCount: number,
  disputeId: string,
  organizationId?: string
): Promise<{ success: boolean; error?: string; id?: string }> {
  const branding = await getOrganizationBranding(organizationId);
  const template = disputeCreatedEmail(clientName, cra, accountCount, disputeId, branding);
  return sendEmail({
    to,
    template,
    tags: [
      { name: "category", value: "dispute-created" },
      { name: "cra", value: cra },
    ],
  });
}

export async function sendDisputeStatusUpdateEmail(
  to: string,
  clientName: string,
  cra: string,
  oldStatus: string,
  newStatus: string,
  statusMessage: string,
  disputeId: string,
  organizationId?: string
): Promise<{ success: boolean; error?: string; id?: string }> {
  const branding = await getOrganizationBranding(organizationId);
  const template = disputeStatusUpdateEmail(
    clientName,
    cra,
    oldStatus,
    newStatus,
    statusMessage,
    disputeId,
    branding
  );
  return sendEmail({
    to,
    template,
    tags: [
      { name: "category", value: "dispute-status" },
      { name: "status", value: newStatus },
    ],
  });
}

export async function sendDeadlineReminderEmail(
  to: string,
  clientName: string,
  cra: string,
  daysRemaining: number,
  sentDate: string,
  deadlineDate: string,
  disputeId: string,
  organizationId?: string
): Promise<{ success: boolean; error?: string; id?: string }> {
  const branding = await getOrganizationBranding(organizationId);
  const template = deadlineReminderEmail(
    clientName,
    cra,
    daysRemaining,
    sentDate,
    deadlineDate,
    disputeId,
    branding
  );
  return sendEmail({
    to,
    template,
    tags: [
      { name: "category", value: "deadline-reminder" },
      { name: "days-remaining", value: String(daysRemaining) },
    ],
  });
}

export async function sendScoreChangeEmail(
  to: string,
  clientName: string,
  cra: string,
  oldScore: number,
  newScore: number,
  changeAmount: number,
  organizationId?: string
): Promise<{ success: boolean; error?: string; id?: string }> {
  const branding = await getOrganizationBranding(organizationId);
  const template = scoreChangeEmail(clientName, cra, oldScore, newScore, changeAmount, branding);
  return sendEmail({
    to,
    template,
    tags: [
      { name: "category", value: "score-change" },
      { name: "direction", value: changeAmount > 0 ? "increase" : "decrease" },
    ],
  });
}

export async function sendPasswordResetEmail(
  to: string,
  userName: string,
  resetToken: string
): Promise<{ success: boolean; error?: string; id?: string }> {
  const template = passwordResetEmail(userName, resetToken, "1 hour");
  return sendEmail({
    to,
    template,
    tags: [{ name: "category", value: "password-reset" }],
  });
}

export async function sendWelcomeEmail(
  to: string,
  userName: string,
  organizationName: string = "Dispute2Go",
  organizationId?: string
): Promise<{ success: boolean; error?: string; id?: string }> {
  const branding = await getOrganizationBranding(organizationId);
  const template = welcomeEmail(userName, organizationName, branding);
  return sendEmail({
    to,
    template,
    tags: [{ name: "category", value: "welcome" }],
  });
}

export async function sendDocumentReadyEmail(
  to: string,
  clientName: string,
  documentType: string,
  documentTitle: string,
  documentId: string,
  organizationId?: string
): Promise<{ success: boolean; error?: string; id?: string }> {
  const branding = await getOrganizationBranding(organizationId);
  const template = documentReadyEmail(clientName, documentType, documentTitle, documentId, branding);
  return sendEmail({
    to,
    template,
    tags: [
      { name: "category", value: "document-ready" },
      { name: "document-type", value: documentType },
    ],
  });
}

// =============================================================================
// BULK EMAIL SUPPORT
// =============================================================================

export interface BulkEmailResult {
  total: number;
  sent: number;
  failed: number;
  results: Array<{
    email: string;
    success: boolean;
    error?: string;
    id?: string;
  }>;
}

export async function sendBulkEmail(
  recipients: Array<{ email: string; data: Record<string, unknown> }>,
  templateFn: (data: Record<string, unknown>) => EmailTemplate
): Promise<BulkEmailResult> {
  const results: BulkEmailResult = {
    total: recipients.length,
    sent: 0,
    failed: 0,
    results: [],
  };

  // Process in batches of 10 to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async ({ email, data }) => {
        const template = templateFn(data);
        const result = await sendEmail({ to: email, template });
        return { email, ...result };
      })
    );

    for (const result of batchResults) {
      results.results.push(result);
      if (result.success) {
        results.sent++;
      } else {
        results.failed++;
      }
    }

    // Small delay between batches
    if (i + batchSize < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}
