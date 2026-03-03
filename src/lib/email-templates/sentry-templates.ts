/**
 * Sentry Mode Email Templates
 *
 * Branded D2G email templates for Sentry Mode communications.
 * Includes client-facing notifications (item removed, score improved,
 * milestone, next round, goal achieved) and specialist alerts
 * (diff results, auto-escalation).
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
// CLIENT-FACING TEMPLATES
// =============================================================================

/**
 * Sentry Item Removed — sent when a negative item is successfully removed
 */
export function sentryItemRemovedTemplate(
  data: {
    clientName: string;
    itemName: string;
    cra: string;
    portalUrl: string;
  },
  opts: TemplateOptions = {}
): string {
  const content = `
    ${text.heading("Great news — an item was removed!")}
    ${text.paragraph(`Hi ${data.clientName},`)}
    ${text.paragraph(`We're happy to report that the following item has been successfully removed from your ${data.cra} credit report:`)}
    <div style="margin: 24px 0; padding: 20px; background-color: #dcfce7; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 4px; font-size: 14px; color: #166534;">Removed Item</p>
      <p style="margin: 0; font-size: 20px; font-weight: 700; color: #166534;">${data.itemName}</p>
    </div>
    ${createTable([
      { label: "Credit Bureau", value: data.cra },
      { label: "Status", value: "Deleted" },
    ])}
    ${text.paragraph("This removal should positively impact your credit profile. Log in to your portal to see the updated details.")}
    ${createButton("View Your Progress", data.portalUrl)}
    ${createDivider()}
    ${text.small("Sentry Mode is actively monitoring your credit reports for changes. We'll keep you posted on any further updates.")}
  `;

  return wrapInTemplate(content, {
    preheader: `${data.itemName} was removed from your ${data.cra} report`,
    ...opts,
  });
}

// =============================================================================
// SCORE IMPROVED
// =============================================================================

/**
 * Sentry Score Improved — sent when a credit score increase is detected
 */
export function sentryScoreImprovedTemplate(
  data: {
    clientName: string;
    oldScore: number;
    newScore: number;
    change: number;
    portalUrl: string;
  },
  opts: TemplateOptions = {}
): string {
  const content = `
    ${text.heading("Your credit score went up!")}
    ${text.paragraph(`Hi ${data.clientName},`)}
    ${text.paragraph("Sentry Mode detected a positive change in your credit score. Here are the details:")}
    <div style="margin: 24px 0; padding: 24px; background-color: #f4f4f5; border-radius: 8px; text-align: center;">
      <div style="display: inline-block; vertical-align: middle;">
        <p style="margin: 0 0 4px; font-size: 14px; color: #71717a;">Previous Score</p>
        <p style="margin: 0; font-size: 24px; font-weight: 600; color: #71717a;">${data.oldScore}</p>
      </div>
      <span style="display: inline-block; margin: 0 20px; font-size: 24px; color: #a1a1aa;">&rarr;</span>
      <div style="display: inline-block; vertical-align: middle;">
        <p style="margin: 0 0 4px; font-size: 14px; color: #71717a;">New Score</p>
        <p style="margin: 0; font-size: 32px; font-weight: 700; color: #166534;">${data.newScore}</p>
      </div>
    </div>
    <p style="text-align: center; margin: 0 0 24px;">
      ${createBadge(`+${data.change} points`, "success")}
    </p>
    ${text.paragraph("Your credit repair efforts are paying off. Keep it up!")}
    ${createButton("View Score Details", data.portalUrl)}
    ${createDivider()}
    ${text.small("Sentry Mode will continue monitoring your reports and notify you of any further changes.")}
  `;

  return wrapInTemplate(content, {
    preheader: `Your credit score increased by ${data.change} points`,
    ...opts,
  });
}

// =============================================================================
// MILESTONE
// =============================================================================

/**
 * Sentry Milestone — sent when a client reaches a major credit repair milestone
 */
export function sentryMilestoneTemplate(
  data: {
    clientName: string;
    milestoneName: string;
    currentScore: number;
    targetScore: number;
    progressPercent: number;
    portalUrl: string;
  },
  opts: TemplateOptions = {}
): string {
  const clampedPercent = Math.min(Math.max(data.progressPercent, 0), 100);

  const content = `
    ${text.heading("You've reached a major milestone!")}
    ${text.paragraph(`Hi ${data.clientName},`)}
    ${text.paragraph(`Congratulations — you've hit an important milestone in your credit repair journey:`)}
    <div style="margin: 24px 0; padding: 20px; background-color: #dbeafe; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 8px; font-size: 14px; color: #1e40af;">Milestone Reached</p>
      <p style="margin: 0; font-size: 22px; font-weight: 700; color: #1e40af;">${data.milestoneName}</p>
    </div>
    ${createTable([
      { label: "Current Score", value: data.currentScore.toString() },
      { label: "Target Score", value: data.targetScore.toString() },
      { label: "Progress", value: `${clampedPercent}%` },
    ])}
    <div style="margin: 16px 0 24px; background-color: #e4e4e7; border-radius: 9999px; height: 12px; overflow: hidden;">
      <div style="width: ${clampedPercent}%; height: 100%; background-color: #7c3aed; border-radius: 9999px;"></div>
    </div>
    ${text.paragraph("You're making real progress. Stay the course and we'll keep working toward your target.")}
    ${createButton("View Your Progress", data.portalUrl)}
    ${createDivider()}
    ${text.small("Sentry Mode is tracking your progress around the clock. We'll notify you as you reach each new milestone.")}
  `;

  return wrapInTemplate(content, {
    preheader: `Milestone reached: ${data.milestoneName} — ${clampedPercent}% toward your goal`,
    ...opts,
  });
}

// =============================================================================
// NEXT ROUND
// =============================================================================

/**
 * Sentry Next Round — sent when verified items trigger a new dispute round
 */
export function sentryNextRoundTemplate(
  data: {
    clientName: string;
    verifiedCount: number;
    nextRound: number;
    portalUrl: string;
  },
  opts: TemplateOptions = {}
): string {
  const content = `
    ${text.heading("We're continuing to fight for you")}
    ${text.paragraph(`Hi ${data.clientName},`)}
    ${text.paragraph(`After reviewing the latest results, ${data.verifiedCount} item${data.verifiedCount !== 1 ? "s" : ""} came back as verified by the credit bureau. That doesn't mean we stop here.`)}
    <div style="margin: 24px 0; padding: 20px; background-color: #f4f4f5; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 4px; font-size: 14px; color: #71717a;">Next Dispute Round</p>
      <p style="margin: 0; font-size: 36px; font-weight: 700; color: #7c3aed;">Round ${data.nextRound}</p>
    </div>
    ${createTable([
      { label: "Verified Items", value: data.verifiedCount.toString() },
      { label: "Upcoming Round", value: `Round ${data.nextRound}` },
    ])}
    ${text.paragraph("Your specialist is preparing a new round of disputes using updated strategies. We'll keep pushing until every possible item is resolved.")}
    ${createButton("View Dispute Details", data.portalUrl)}
    ${createDivider()}
    ${text.small("Sentry Mode automatically detects when new rounds are needed and keeps your disputes moving forward.")}
  `;

  return wrapInTemplate(content, {
    preheader: `Round ${data.nextRound} disputes are being prepared for your account`,
    ...opts,
  });
}

// =============================================================================
// GOAL ACHIEVED
// =============================================================================

/**
 * Sentry Goal Achieved — sent when a client reaches their credit repair goal
 */
export function sentryGoalAchievedTemplate(
  data: {
    clientName: string;
    goalType: string;
    startScore: number;
    finalScore: number;
    portalUrl: string;
  },
  opts: TemplateOptions = {}
): string {
  const totalGain = data.finalScore - data.startScore;

  const content = `
    ${text.heading("Congratulations!")}
    ${text.paragraph(`Hi ${data.clientName},`)}
    ${text.paragraph(`You did it! You've reached your ${data.goalType} goal. This is a huge accomplishment and a testament to your commitment.`)}
    <div style="margin: 24px 0; padding: 24px; background-color: #dcfce7; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 8px; font-size: 14px; color: #166534;">Goal Achieved</p>
      <p style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #166534;">${data.goalType}</p>
      <div style="display: inline-block; vertical-align: middle;">
        <p style="margin: 0 0 4px; font-size: 14px; color: #166534;">Started At</p>
        <p style="margin: 0; font-size: 24px; font-weight: 600; color: #166534;">${data.startScore}</p>
      </div>
      <span style="display: inline-block; margin: 0 20px; font-size: 24px; color: #166534;">&rarr;</span>
      <div style="display: inline-block; vertical-align: middle;">
        <p style="margin: 0 0 4px; font-size: 14px; color: #166534;">Final Score</p>
        <p style="margin: 0; font-size: 32px; font-weight: 700; color: #166534;">${data.finalScore}</p>
      </div>
    </div>
    <p style="text-align: center; margin: 0 0 24px;">
      ${createBadge(`+${totalGain} points total improvement`, "success")}
    </p>
    ${text.paragraph("Log in to your portal to review your full journey and see what's next.")}
    ${createButton("View Your Results", data.portalUrl)}
    ${createDivider()}
    ${text.small("Even though your goal is reached, Sentry Mode can continue monitoring your reports to protect your progress.")}
  `;

  return wrapInTemplate(content, {
    preheader: `You've achieved your ${data.goalType} goal — +${totalGain} points!`,
    ...opts,
  });
}

// =============================================================================
// SPECIALIST ALERTS
// =============================================================================

/**
 * Sentry Diff Results — specialist alert with analysis results summary
 */
export function sentryDiffResultsTemplate(
  data: {
    specialistName: string;
    clientName: string;
    deletedCount: number;
    verifiedCount: number;
    scoreChange: number;
    reviewUrl: string;
  },
  opts: TemplateOptions = {}
): string {
  const scoreDisplay = data.scoreChange > 0
    ? `+${data.scoreChange}`
    : data.scoreChange.toString();
  const scoreBadgeType = data.scoreChange > 0 ? "success" : data.scoreChange < 0 ? "error" : "info";

  const content = `
    ${text.heading("Sentry Mode: Diff Results Ready")}
    ${text.paragraph(`Hi ${data.specialistName},`)}
    ${text.paragraph(`Sentry Mode has completed a credit report comparison for ${text.bold(data.clientName)}. Here is the summary:`)}
    ${createTable([
      { label: "Client", value: data.clientName },
      { label: "Items Deleted", value: data.deletedCount.toString() },
      { label: "Items Verified", value: data.verifiedCount.toString() },
      { label: "Score Change", value: scoreDisplay },
    ])}
    <p style="margin: 0 0 24px;">
      Score Impact: ${createBadge(`${scoreDisplay} points`, scoreBadgeType)}
    </p>
    ${data.verifiedCount > 0
      ? text.paragraph(`${data.verifiedCount} item${data.verifiedCount !== 1 ? "s were" : " was"} verified and may require a follow-up dispute round. Review the full analysis to determine next steps.`)
      : text.paragraph("All disputed items were resolved favorably. No further action is needed at this time.")
    }
    ${createButton("Review Full Analysis", data.reviewUrl)}
    ${createDivider()}
    ${text.small("This is an automated alert from Sentry Mode. Review and take action at your earliest convenience.")}
  `;

  return wrapInTemplate(content, {
    preheader: `Sentry results for ${data.clientName}: ${data.deletedCount} deleted, ${data.verifiedCount} verified`,
    ...opts,
  });
}

/**
 * Sentry Auto-Escalation — specialist alert when verified items trigger automatic escalation
 */
export function sentryAutoEscalationTemplate(
  data: {
    specialistName: string;
    clientName: string;
    verifiedCount: number;
    nextRound: number;
    reviewUrl: string;
  },
  opts: TemplateOptions = {}
): string {
  const content = `
    ${text.heading("Sentry Mode: Auto-Escalation Triggered")}
    ${text.paragraph(`Hi ${data.specialistName},`)}
    ${text.paragraph(`Sentry Mode has detected ${text.bold(data.verifiedCount.toString())} verified item${data.verifiedCount !== 1 ? "s" : ""} on ${text.bold(data.clientName)}'s credit report and has automatically escalated the case to Round ${data.nextRound}.`)}
    <div style="margin: 24px 0; padding: 20px; background-color: #fef3c7; border-radius: 8px;">
      <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #92400e;">Action Required</p>
      <p style="margin: 0; font-size: 14px; color: #92400e;">Please review the escalation details and approve or adjust the next round of disputes before they are sent.</p>
    </div>
    ${createTable([
      { label: "Client", value: data.clientName },
      { label: "Verified Items", value: data.verifiedCount.toString() },
      { label: "Escalated To", value: `Round ${data.nextRound}` },
    ])}
    ${text.paragraph("The new dispute round has been drafted and is awaiting your review. Approve it to keep the process moving, or make adjustments as needed.")}
    ${createButton("Review Escalation", data.reviewUrl)}
    ${createDivider()}
    ${text.small("This is an automated escalation from Sentry Mode. No disputes will be sent until you approve them.")}
  `;

  return wrapInTemplate(content, {
    preheader: `Auto-escalation: ${data.clientName} moved to Round ${data.nextRound} (${data.verifiedCount} verified items)`,
    ...opts,
  });
}
