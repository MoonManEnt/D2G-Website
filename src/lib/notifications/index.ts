/**
 * Notification Service
 *
 * Handles in-app notifications for users. Notifications are stored in the
 * Notification model and can be displayed in a notification center.
 */

import { prisma } from "@/lib/prisma";

// =============================================================================
// TYPES
// =============================================================================

export type NotificationType =
  | "DISPUTE_CREATED"
  | "DISPUTE_SENT"
  | "DISPUTE_RESPONSE"
  | "DISPUTE_RESOLVED"
  | "DEADLINE_WARNING"
  | "DEADLINE_MISSED"
  | "FCRA_VIOLATION"
  | "CLIENT_ADDED"
  | "REPORT_UPLOADED"
  | "REPORT_PARSED"
  | "SUBSCRIPTION_WARNING"
  | "SUBSCRIPTION_LIMIT"
  | "SYSTEM_MESSAGE";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  linkUrl?: string;
  linkText?: string;
}

export interface NotificationWithMeta {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  linkUrl: string | null;
  linkText: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

// =============================================================================
// NOTIFICATION TEMPLATES
// =============================================================================

const NOTIFICATION_TEMPLATES: Record<
  NotificationType,
  { title: string; message: (data: Record<string, string>) => string }
> = {
  DISPUTE_CREATED: {
    title: "New Dispute Created",
    message: (d) => `A new ${d.cra} dispute (Round ${d.round}) was created for ${d.clientName}.`,
  },
  DISPUTE_SENT: {
    title: "Dispute Sent",
    message: (d) => `${d.cra} dispute for ${d.clientName} has been sent. Response deadline: ${d.deadline}.`,
  },
  DISPUTE_RESPONSE: {
    title: "Response Received",
    message: (d) => `${d.cra} responded to ${d.clientName}'s dispute. ${d.deletedCount} item(s) deleted.`,
  },
  DISPUTE_RESOLVED: {
    title: "Dispute Resolved",
    message: (d) => `${d.clientName}'s ${d.cra} dispute has been resolved.`,
  },
  DEADLINE_WARNING: {
    title: "Response Deadline Approaching",
    message: (d) => `${d.cra} has ${d.daysRemaining} days to respond to ${d.clientName}'s dispute.`,
  },
  DEADLINE_MISSED: {
    title: "FCRA Deadline Missed",
    message: (d) => `${d.cra} missed the 30-day deadline for ${d.clientName}. Items deleted by operation of law.`,
  },
  FCRA_VIOLATION: {
    title: "FCRA Violation Detected",
    message: (d) => `Potential FCRA violation detected for ${d.clientName}. Consider filing a CFPB complaint.`,
  },
  CLIENT_ADDED: {
    title: "New Client Added",
    message: (d) => `${d.clientName} has been added to your organization.`,
  },
  REPORT_UPLOADED: {
    title: "Credit Report Uploaded",
    message: (d) => `A new ${d.cra} credit report was uploaded for ${d.clientName}.`,
  },
  REPORT_PARSED: {
    title: "Credit Report Parsed",
    message: (d) => `${d.clientName}'s credit report has been parsed. ${d.issueCount} issues detected.`,
  },
  SUBSCRIPTION_WARNING: {
    title: "Approaching Usage Limit",
    message: (d) => `You've used ${d.percentage}% of your monthly ${d.limitType} limit.`,
  },
  SUBSCRIPTION_LIMIT: {
    title: "Usage Limit Reached",
    message: (d) => `You've reached your monthly ${d.limitType} limit. Upgrade to continue.`,
  },
  SYSTEM_MESSAGE: {
    title: "System Notification",
    message: (d) => d.message,
  },
};

// =============================================================================
// NOTIFICATION SERVICE
// =============================================================================

export const NotificationService = {
  /**
   * Create a custom notification
   */
  async create(input: CreateNotificationInput): Promise<NotificationWithMeta> {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        linkUrl: input.linkUrl,
        linkText: input.linkText,
      },
    });

    return notification;
  },

  /**
   * Create a notification from a template
   */
  async notify(
    userId: string,
    type: NotificationType,
    data: Record<string, string>,
    link?: { url: string; text: string }
  ): Promise<NotificationWithMeta> {
    const template = NOTIFICATION_TEMPLATES[type];

    return this.create({
      userId,
      type,
      title: template.title,
      message: template.message(data),
      linkUrl: link?.url,
      linkText: link?.text,
    });
  },

  /**
   * Notify all users in an organization
   */
  async notifyOrganization(
    organizationId: string,
    type: NotificationType,
    data: Record<string, string>,
    link?: { url: string; text: string }
  ): Promise<void> {
    const users = await prisma.user.findMany({
      where: { organizationId, isActive: true },
      select: { id: true },
    });

    await Promise.all(
      users.map((user) => this.notify(user.id, type, data, link))
    );
  },

  /**
   * Get unread notifications for a user
   */
  async getUnread(userId: string, limit = 20): Promise<NotificationWithMeta[]> {
    return prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  /**
   * Get all notifications for a user with pagination
   */
  async getAll(
    userId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ notifications: NotificationWithMeta[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
    ]);

    return { notifications, total };
  },

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  },

  /**
   * Delete old notifications (cleanup job)
   */
  async deleteOld(daysOld = 90): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    const result = await prisma.notification.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    return result.count;
  },
};

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Notify about dispute events
 */
export async function notifyDisputeCreated(
  userId: string,
  clientName: string,
  cra: string,
  round: number,
  disputeId: string
): Promise<void> {
  await NotificationService.notify(
    userId,
    "DISPUTE_CREATED",
    { clientName, cra, round: String(round) },
    { url: `/disputes/${disputeId}`, text: "View Dispute" }
  );
}

export async function notifyDisputeSent(
  userId: string,
  clientName: string,
  cra: string,
  deadline: string,
  disputeId: string
): Promise<void> {
  await NotificationService.notify(
    userId,
    "DISPUTE_SENT",
    { clientName, cra, deadline },
    { url: `/disputes/${disputeId}`, text: "View Dispute" }
  );
}

export async function notifyDeadlineWarning(
  userId: string,
  clientName: string,
  cra: string,
  daysRemaining: number,
  disputeId: string
): Promise<void> {
  await NotificationService.notify(
    userId,
    "DEADLINE_WARNING",
    { clientName, cra, daysRemaining: String(daysRemaining) },
    { url: `/disputes/${disputeId}`, text: "View Dispute" }
  );
}

export async function notifyFCRAViolation(
  userId: string,
  clientName: string,
  cra: string,
  disputeId: string
): Promise<void> {
  await NotificationService.notify(
    userId,
    "FCRA_VIOLATION",
    { clientName, cra },
    { url: `/disputes/${disputeId}/cfpb`, text: "File CFPB Complaint" }
  );
}

export async function notifySubscriptionLimit(
  userId: string,
  limitType: string,
  percentage: number
): Promise<void> {
  const type = percentage >= 100 ? "SUBSCRIPTION_LIMIT" : "SUBSCRIPTION_WARNING";
  await NotificationService.notify(
    userId,
    type,
    { limitType, percentage: String(percentage) },
    { url: "/settings/billing", text: "Upgrade Plan" }
  );
}
