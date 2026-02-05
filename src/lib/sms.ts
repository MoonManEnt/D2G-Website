// SMS notifications via Twilio

import { isFeatureEnabled } from "./env";
import { createLogger } from "./logger";
const log = createLogger("sms");

interface TwilioClient {
  messages: {
    create: (params: {
      body: string;
      to: string;
      from: string;
    }) => Promise<{ sid: string; status: string }>;
  };
}

let twilioClient: TwilioClient | null = null;

async function getTwilioClient(): Promise<TwilioClient | null> {
  if (!isFeatureEnabled("sms")) {
    return null;
  }

  if (!twilioClient) {
    // Dynamic import to avoid loading Twilio if not configured
    try {
      const twilio = await import("twilio");
      twilioClient = twilio.default(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    } catch (error) {
      log.error({ err: error }, "Failed to initialize Twilio client");
      return null;
    }
  }

  return twilioClient;
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an SMS message
 */
export async function sendSMS(to: string, message: string): Promise<SMSResult> {
  const client = await getTwilioClient();

  if (!client) {
    log.info({ to, message }, "[SMS Disabled] Would send to");
    return { success: false, error: "SMS not configured" };
  }

  try {
    // Format phone number (ensure E.164 format)
    const formattedTo = formatPhoneNumber(to);

    const result = await client.messages.create({
      body: message,
      to: formattedTo,
      from: process.env.TWILIO_PHONE_NUMBER!,
    });

    return {
      success: true,
      messageId: result.sid,
    };
  } catch (error) {
    log.error({ err: error }, "SMS send failed");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Format phone number to E.164 format
 */
function formatPhoneNumber(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, "");

  // If it starts with 1 and has 11 digits (US)
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // If it has 10 digits (US without country code)
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Otherwise return with + prefix
  return digits.startsWith("+") ? phone : `+${digits}`;
}

// ============================================
// SMS Templates
// ============================================

export const smsTemplates = {
  /**
   * Welcome message for new clients
   */
  welcome: (firstName: string, companyName: string = "Dispute2Go") =>
    `Welcome ${firstName}! Your account with ${companyName} has been created. You'll receive updates about your credit repair progress via text.`,

  /**
   * Dispute created notification
   */
  disputeCreated: (cra: string, itemCount: number) =>
    `Your ${cra} dispute has been created with ${itemCount} item(s). We'll notify you when it's ready for review.`,

  /**
   * Dispute approved and ready to send
   */
  disputeApproved: (cra: string) =>
    `Great news! Your ${cra} dispute letter has been approved and is ready to be mailed.`,

  /**
   * Dispute sent to CRA
   */
  disputeSent: (cra: string) =>
    `Your dispute letter has been sent to ${cra}. They have 30 days to respond per FCRA requirements.`,

  /**
   * Dispute response received
   */
  disputeResponse: (cra: string, outcome: string) =>
    `${cra} has responded to your dispute. Outcome: ${outcome}. Log in to view details.`,

  /**
   * Dispute resolved
   */
  disputeResolved: (cra: string, deletedCount: number) =>
    deletedCount > 0
      ? `Success! ${deletedCount} item(s) have been removed from your ${cra} credit report!`
      : `Your ${cra} dispute has been resolved. Log in to view the outcome.`,

  /**
   * Credit report uploaded
   */
  reportUploaded: (accountCount: number) =>
    `Your credit report has been analyzed. We found ${accountCount} accounts to review. Log in to see details.`,

  /**
   * Follow-up reminder
   */
  followUpReminder: (cra: string, daysSinceSent: number) =>
    `Reminder: It's been ${daysSinceSent} days since your ${cra} dispute was sent. They have ${Math.max(0, 30 - daysSinceSent)} days left to respond.`,

  /**
   * 30-day deadline passed
   */
  deadlinePassed: (cra: string) =>
    `Important: ${cra} has exceeded the 30-day response deadline. You may have grounds for a CFPB complaint. Log in for next steps.`,

  /**
   * Password reset code
   */
  passwordReset: (code: string) =>
    `Your password reset code is: ${code}. This code expires in 1 hour.`,

  /**
   * Appointment reminder
   */
  appointmentReminder: (dateTime: string) =>
    `Reminder: You have a credit consultation scheduled for ${dateTime}. Reply CONFIRM to confirm.`,
};

// ============================================
// Notification Functions
// ============================================

/**
 * Send welcome SMS to new client
 */
export async function sendWelcomeSMS(
  phone: string,
  firstName: string,
  companyName?: string
): Promise<SMSResult> {
  return sendSMS(phone, smsTemplates.welcome(firstName, companyName));
}

/**
 * Send dispute status update
 */
export async function sendDisputeUpdateSMS(
  phone: string,
  cra: string,
  status: "created" | "approved" | "sent" | "responded" | "resolved",
  metadata?: { itemCount?: number; outcome?: string; deletedCount?: number }
): Promise<SMSResult> {
  let message: string;

  switch (status) {
    case "created":
      message = smsTemplates.disputeCreated(cra, metadata?.itemCount || 0);
      break;
    case "approved":
      message = smsTemplates.disputeApproved(cra);
      break;
    case "sent":
      message = smsTemplates.disputeSent(cra);
      break;
    case "responded":
      message = smsTemplates.disputeResponse(cra, metadata?.outcome || "See details online");
      break;
    case "resolved":
      message = smsTemplates.disputeResolved(cra, metadata?.deletedCount || 0);
      break;
    default:
      return { success: false, error: "Unknown status" };
  }

  return sendSMS(phone, message);
}

/**
 * Send follow-up reminder
 */
export async function sendFollowUpReminderSMS(
  phone: string,
  cra: string,
  daysSinceSent: number
): Promise<SMSResult> {
  if (daysSinceSent >= 30) {
    return sendSMS(phone, smsTemplates.deadlinePassed(cra));
  }
  return sendSMS(phone, smsTemplates.followUpReminder(cra, daysSinceSent));
}

/**
 * Send report uploaded notification
 */
export async function sendReportUploadedSMS(
  phone: string,
  accountCount: number
): Promise<SMSResult> {
  return sendSMS(phone, smsTemplates.reportUploaded(accountCount));
}
