/**
 * Email templates for Dispute2Go
 */

import {
  wrapInTemplate,
  createButton,
  createBadge,
  createTable,
  createDivider,
  text,
  BrandingConfig,
} from "./base";

interface TemplateOptions {
  branding?: Partial<BrandingConfig>;
}

// =============================================================================
// PORTAL INVITE
// =============================================================================

export function portalInviteTemplate(
  data: {
    clientName: string;
    organizationName: string;
    inviteUrl: string;
  },
  options: TemplateOptions = {}
): string {
  const content = `
    ${text.heading(`Welcome to ${data.organizationName}`)}
    ${text.paragraph(`Hi ${data.clientName},`)}
    ${text.paragraph(`You've been invited to access your client portal. This secure portal allows you to:`)}
    <ul style="margin: 0 0 16px; padding-left: 24px; color: #3f3f46;">
      <li style="margin-bottom: 8px;">View your credit repair progress</li>
      <li style="margin-bottom: 8px;">Track dispute statuses</li>
      <li style="margin-bottom: 8px;">Monitor credit score changes</li>
      <li style="margin-bottom: 8px;">Access important documents</li>
    </ul>
    ${text.paragraph("Click the button below to set up your password and activate your account:")}
    ${createButton("Activate Your Account", data.inviteUrl)}
    ${text.small("This invitation link will expire in 7 days.")}
    ${createDivider()}
    ${text.small(`If you didn't expect this email, please contact ${data.organizationName}.`)}
  `;

  return wrapInTemplate(content, {
    preheader: `Set up your client portal access for ${data.organizationName}`,
    ...options,
  });
}

// =============================================================================
// DISPUTE CREATED
// =============================================================================

export function disputeCreatedTemplate(
  data: {
    clientName: string;
    cra: string;
    accountCount: number;
    disputeId: string;
    portalUrl: string;
  },
  options: TemplateOptions = {}
): string {
  const content = `
    ${text.heading("New Dispute Created")}
    ${text.paragraph(`Hi ${data.clientName},`)}
    ${text.paragraph(`Great news! A new dispute has been created on your behalf.`)}
    ${createTable([
      { label: "Credit Bureau", value: data.cra },
      { label: "Accounts Included", value: data.accountCount.toString() },
      { label: "Dispute ID", value: data.disputeId.slice(0, 8).toUpperCase() },
    ])}
    ${text.paragraph("Your credit repair specialist will review the dispute letter and submit it to the credit bureau. You'll receive updates as the dispute progresses.")}
    ${createButton("View in Portal", data.portalUrl)}
    ${createDivider()}
    ${text.subheading("What happens next?")}
    <ol style="margin: 0 0 16px; padding-left: 24px; color: #3f3f46;">
      <li style="margin-bottom: 8px;">Your dispute letter is reviewed and finalized</li>
      <li style="margin-bottom: 8px;">The letter is sent to ${data.cra}</li>
      <li style="margin-bottom: 8px;">The bureau has 30 days to investigate</li>
      <li style="margin-bottom: 8px;">You'll be notified when we receive a response</li>
    </ol>
  `;

  return wrapInTemplate(content, {
    preheader: `New ${data.cra} dispute created with ${data.accountCount} account(s)`,
    ...options,
  });
}

// =============================================================================
// DISPUTE STATUS UPDATE
// =============================================================================

export function disputeStatusUpdateTemplate(
  data: {
    clientName: string;
    cra: string;
    oldStatus: string;
    newStatus: string;
    statusMessage: string;
    portalUrl: string;
  },
  options: TemplateOptions = {}
): string {
  const statusType = data.newStatus.includes("RESOLVED_POSITIVE")
    ? "success"
    : data.newStatus.includes("RESOLVED_NEGATIVE")
    ? "error"
    : "info";

  const content = `
    ${text.heading("Dispute Status Update")}
    ${text.paragraph(`Hi ${data.clientName},`)}
    ${text.paragraph(`Your ${data.cra} dispute has been updated.`)}
    <div style="margin: 24px 0; padding: 20px; background-color: #f4f4f5; border-radius: 8px;">
      <p style="margin: 0 0 8px; font-size: 14px; color: #71717a;">Status changed from ${text.bold(data.oldStatus.replace(/_/g, " "))} to:</p>
      <p style="margin: 0; font-size: 18px; font-weight: 600;">${createBadge(data.newStatus.replace(/_/g, " "), statusType)}</p>
    </div>
    ${text.paragraph(data.statusMessage)}
    ${createButton("View Details", data.portalUrl)}
  `;

  return wrapInTemplate(content, {
    preheader: `Your ${data.cra} dispute status: ${data.newStatus.replace(/_/g, " ")}`,
    ...options,
  });
}

// =============================================================================
// DEADLINE REMINDER
// =============================================================================

export function deadlineReminderTemplate(
  data: {
    clientName: string;
    cra: string;
    daysRemaining: number;
    sentDate: string;
    deadlineDate: string;
    portalUrl: string;
  },
  options: TemplateOptions = {}
): string {
  const urgency = data.daysRemaining <= 5 ? "warning" : "info";

  const content = `
    ${text.heading("Dispute Deadline Approaching")}
    ${text.paragraph(`Hi ${data.clientName},`)}
    ${text.paragraph(`Your dispute with ${data.cra} is approaching its response deadline.`)}
    <div style="margin: 24px 0; padding: 20px; background-color: ${urgency === "warning" ? "#fef3c7" : "#dbeafe"}; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 4px; font-size: 14px; color: #71717a;">Days Remaining</p>
      <p style="margin: 0; font-size: 36px; font-weight: 700; color: ${urgency === "warning" ? "#92400e" : "#1e40af"};">${data.daysRemaining}</p>
    </div>
    ${createTable([
      { label: "Credit Bureau", value: data.cra },
      { label: "Dispute Sent", value: data.sentDate },
      { label: "Response Deadline", value: data.deadlineDate },
    ])}
    ${text.paragraph("Under the FCRA, credit bureaus must respond within 30 days. If no response is received by the deadline, the disputed items may be eligible for automatic removal.")}
    ${createButton("View Dispute Status", data.portalUrl)}
  `;

  return wrapInTemplate(content, {
    preheader: `${data.daysRemaining} days until ${data.cra} dispute deadline`,
    ...options,
  });
}

// =============================================================================
// SCORE CHANGE NOTIFICATION
// =============================================================================

export function scoreChangeTemplate(
  data: {
    clientName: string;
    cra: string;
    oldScore: number;
    newScore: number;
    changeAmount: number;
    portalUrl: string;
  },
  options: TemplateOptions = {}
): string {
  const isPositive = data.changeAmount > 0;
  const changeType = isPositive ? "success" : "error";

  const content = `
    ${text.heading("Credit Score Update")}
    ${text.paragraph(`Hi ${data.clientName},`)}
    ${text.paragraph(`Your ${data.cra} credit score has changed.`)}
    <div style="margin: 24px 0; padding: 24px; background-color: #f4f4f5; border-radius: 8px; text-align: center;">
      <div style="display: inline-block; vertical-align: middle;">
        <p style="margin: 0 0 4px; font-size: 14px; color: #71717a;">Previous Score</p>
        <p style="margin: 0; font-size: 24px; font-weight: 600; color: #71717a;">${data.oldScore}</p>
      </div>
      <span style="display: inline-block; margin: 0 20px; font-size: 24px; color: #a1a1aa;">&rarr;</span>
      <div style="display: inline-block; vertical-align: middle;">
        <p style="margin: 0 0 4px; font-size: 14px; color: #71717a;">New Score</p>
        <p style="margin: 0; font-size: 32px; font-weight: 700; color: #18181b;">${data.newScore}</p>
      </div>
    </div>
    <p style="text-align: center; margin: 0 0 24px;">
      ${createBadge(`${isPositive ? "+" : ""}${data.changeAmount} points`, changeType)}
    </p>
    ${text.paragraph(isPositive
      ? "Great progress! Your credit repair efforts are paying off."
      : "Don't worry - credit scores can fluctuate. Your specialist will continue working on your disputes."
    )}
    ${createButton("View Full Report", data.portalUrl)}
  `;

  return wrapInTemplate(content, {
    preheader: `Your ${data.cra} score ${isPositive ? "increased" : "changed"} by ${Math.abs(data.changeAmount)} points`,
    ...options,
  });
}

// =============================================================================
// PASSWORD RESET
// =============================================================================

export function passwordResetTemplate(
  data: {
    userName: string;
    resetUrl: string;
    expiresIn: string;
  },
  options: TemplateOptions = {}
): string {
  const content = `
    ${text.heading("Reset Your Password")}
    ${text.paragraph(`Hi ${data.userName},`)}
    ${text.paragraph("We received a request to reset your password. Click the button below to create a new password:")}
    ${createButton("Reset Password", data.resetUrl)}
    ${text.small(`This link will expire in ${data.expiresIn}.`)}
    ${createDivider()}
    ${text.paragraph("If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.")}
    ${text.small("For security, this link can only be used once.")}
  `;

  return wrapInTemplate(content, {
    preheader: "Reset your password",
    ...options,
  });
}

// =============================================================================
// WELCOME EMAIL (After account creation)
// =============================================================================

export function welcomeTemplate(
  data: {
    userName: string;
    organizationName: string;
    loginUrl: string;
  },
  options: TemplateOptions = {}
): string {
  const content = `
    ${text.heading(`Welcome to ${data.organizationName}!`)}
    ${text.paragraph(`Hi ${data.userName},`)}
    ${text.paragraph("Your account has been created successfully. We're excited to help you on your credit repair journey.")}
    ${createDivider()}
    ${text.subheading("Getting Started")}
    <ol style="margin: 0 0 16px; padding-left: 24px; color: #3f3f46;">
      <li style="margin-bottom: 8px;">Upload your credit report (IdentityIQ or similar)</li>
      <li style="margin-bottom: 8px;">Review identified negative items</li>
      <li style="margin-bottom: 8px;">Create and send disputes</li>
      <li style="margin-bottom: 8px;">Track your progress</li>
    </ol>
    ${createButton("Login to Dashboard", data.loginUrl)}
    ${text.small("If you have any questions, don't hesitate to reach out to our support team.")}
  `;

  return wrapInTemplate(content, {
    preheader: `Welcome to ${data.organizationName} - Let's get started!`,
    ...options,
  });
}

// =============================================================================
// DOCUMENT READY
// =============================================================================

export function documentReadyTemplate(
  data: {
    clientName: string;
    documentType: string;
    documentTitle: string;
    portalUrl: string;
  },
  options: TemplateOptions = {}
): string {
  const content = `
    ${text.heading("Document Ready for Review")}
    ${text.paragraph(`Hi ${data.clientName},`)}
    ${text.paragraph("A new document has been prepared and is ready for your review.")}
    ${createTable([
      { label: "Document Type", value: data.documentType },
      { label: "Title", value: data.documentTitle },
    ])}
    ${text.paragraph("Please log in to your portal to review the document. If you have any questions or need changes, contact your credit repair specialist.")}
    ${createButton("View Document", data.portalUrl)}
  `;

  return wrapInTemplate(content, {
    preheader: `New ${data.documentType} ready for review`,
    ...options,
  });
}


// =============================================================================
// EMAIL VERIFICATION
// =============================================================================

export function emailVerificationTemplate(
  data: {
    userName: string;
    verificationUrl: string;
    expiresIn: string;
  },
  options: TemplateOptions = {}
): string {
  const content = `
    ${text.heading("Verify Your Email Address")}
    ${text.paragraph(`Hi ${data.userName},`)}
    ${text.paragraph("Please verify your email address to complete your account setup. Click the button below to confirm your email:")}
    ${createButton("Verify Email", data.verificationUrl)}
    ${text.small(`This link will expire in ${data.expiresIn}.`)}
    ${createDivider()}
    ${text.paragraph("If you did not create an account, you can safely ignore this email.")}
    ${text.small("For security, this link can only be used once.")}
  `;

  return wrapInTemplate(content, {
    preheader: "Verify your email address",
    ...options,
  });
}

// =============================================================================
// PAYMENT FAILED (Dunning)
// =============================================================================

export function paymentFailedTemplate(
  data: {
    userName: string;
    amountDue: string;
    attemptCount: number;
    nextAttemptDate: string | null;
    billingUrl: string;
  },
): string {
  const isFirstAttempt = data.attemptCount <= 1;
  const isUrgent = data.attemptCount >= 3;

  const content = `
    ${text.heading(isUrgent ? "Urgent: Payment Still Failing" : "Payment Failed")}
    ${text.paragraph(`Hi ${data.userName},`)}
    ${text.paragraph(
      isFirstAttempt
        ? `We were unable to process your payment of <strong>$${data.amountDue}</strong>. This is usually caused by an expired card or insufficient funds.`
        : `We've now attempted to charge your payment of <strong>$${data.amountDue}</strong> ${data.attemptCount} time${data.attemptCount > 1 ? "s" : ""} without success.`
    )}
    ${createTable([
      { label: "Amount Due", value: `$${data.amountDue}` },
      { label: "Attempt", value: `${data.attemptCount} of 4` },
      ...(data.nextAttemptDate ? [{ label: "Next Retry", value: data.nextAttemptDate }] : []),
    ])}
    ${text.paragraph("Please update your payment method to avoid any interruption to your service:")}
    ${createButton("Update Payment Method", data.billingUrl)}
    ${createDivider()}
    ${text.small(
      isUrgent
        ? "If payment is not resolved, your account will be downgraded to the Free plan and you may lose access to premium features."
        : "If you believe this is an error, please contact your bank or reach out to our support team."
    )}
  `;

  return wrapInTemplate(content, {
    preheader: `Action required: Payment of $${data.amountDue} failed`,
  });
}


// =============================================================================
// SUBSCRIPTION CONFIRMATION
// =============================================================================

export function subscriptionConfirmationTemplate(
  data: {
    userName: string;
    tierName: string;
    tierFeatures: string[];
    limits: {
      clients: string;
      disputesPerMonth: string;
      storage: string;
      teamSeats: string;
    };
    isTrialing: boolean;
    trialDaysRemaining?: number;
    welcomeUrl: string;
  },
  options: TemplateOptions = {}
): string {
  const featuresList = data.tierFeatures.length > 0
    ? `
    <ul style="margin: 0 0 16px; padding-left: 24px; color: #3f3f46;">
      ${data.tierFeatures.map((f) => `<li style="margin-bottom: 8px;">${f}</li>`).join("")}
    </ul>`
    : "";

  const trialNotice = data.isTrialing
    ? `
    <div style="margin: 24px 0; padding: 16px; background-color: #dbeafe; border-radius: 8px; text-align: center;">
      <p style="margin: 0; font-size: 14px; color: #1e40af;">
        Your ${data.trialDaysRemaining}-day trial has started. You won't be charged until the trial ends.
      </p>
    </div>`
    : "";

  const content = `
    ${text.heading(`Welcome to Dispute2Go ${data.tierName}!`)}
    ${text.paragraph(`Hi ${data.userName},`)}
    ${text.paragraph(`Your <strong>${data.tierName}</strong> plan is now active. You have access to everything your plan includes.`)}
    ${trialNotice}
    ${createDivider()}
    ${text.subheading("Your Plan Includes")}
    ${createTable([
      { label: "Clients", value: data.limits.clients },
      { label: "Disputes / Month", value: data.limits.disputesPerMonth },
      { label: "Storage", value: data.limits.storage },
      { label: "Team Seats", value: data.limits.teamSeats },
    ])}
    ${featuresList ? `${text.subheading("Premium Features")}${featuresList}` : ""}
    ${text.paragraph("Ready to get started? Add your first client and upload a credit report.")}
    ${createButton("Get Started", data.welcomeUrl)}
    ${createDivider()}
    ${text.small("Have questions? Reply to this email or reach out to our support team.")}
  `;

  return wrapInTemplate(content, {
    preheader: `Your Dispute2Go ${data.tierName} plan is active!`,
    ...options,
  });
}

// =============================================================================
// DAILY SUMMARY
// =============================================================================

export function dailySummaryTemplate(
  data: {
    userName: string;
    organizationName: string;
    date: string;
    newClients: number;
    newDisputes: number;
    resolvedDisputes: number;
    reportsUploaded: number;
    dashboardUrl: string;
  },
  options: TemplateOptions = {}
): string {
  const totalActivity = data.newClients + data.newDisputes + data.resolvedDisputes + data.reportsUploaded;

  const content = `
    ${text.heading(`Daily Summary - ${data.date}`)}
    ${text.paragraph(`Hi ${data.userName},`)}
    ${text.paragraph(`Here is your daily activity summary for ${data.organizationName}.`)}
    ${createTable([
      { label: "New Clients", value: data.newClients.toString() },
      { label: "New Disputes", value: data.newDisputes.toString() },
      { label: "Resolved Disputes", value: data.resolvedDisputes.toString() },
      { label: "Reports Uploaded", value: data.reportsUploaded.toString() },
      { label: "Total Activity", value: totalActivity.toString() },
    ])}
    ${createButton("View Dashboard", data.dashboardUrl)}
  `;

  return wrapInTemplate(content, {
    preheader: `Daily summary: ${totalActivity} activities for ${data.organizationName}`,
    ...options,
  });
}