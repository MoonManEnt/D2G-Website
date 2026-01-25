import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { NotificationService } from "@/lib/notifications";

/**
 * GET /api/notifications - Get notifications for the current user
 *
 * Query params:
 * - unread: "true" to only get unread notifications
 * - page: Page number (default 1)
 * - limit: Items per page (default 20)
 */
export const GET = withAuth(async (req, ctx) => {
  try {
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    if (unreadOnly) {
      const notifications = await NotificationService.getUnread(ctx.userId, limit);
      const unreadCount = notifications.length;

      return NextResponse.json({
        notifications,
        unreadCount,
        page: 1,
        limit,
        total: unreadCount,
      });
    }

    const { notifications, total } = await NotificationService.getAll(ctx.userId, {
      page,
      limit,
    });

    const unreadCount = await NotificationService.getUnreadCount(ctx.userId);

    return NextResponse.json({
      notifications,
      unreadCount,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications", code: "FETCH_ERROR" },
      { status: 500 }
    );
  }
});

/**
 * POST /api/notifications - Mark notifications as read
 *
 * Body:
 * - action: "markRead" | "markAllRead"
 * - notificationId: (optional) ID of notification to mark read
 */
export const POST = withAuth(async (req, ctx) => {
  try {
    const body = await req.json();
    const { action, notificationId } = body;

    if (action === "markAllRead") {
      await NotificationService.markAllAsRead(ctx.userId);
      return NextResponse.json({ success: true, message: "All notifications marked as read" });
    }

    if (action === "markRead" && notificationId) {
      await NotificationService.markAsRead(notificationId, ctx.userId);
      return NextResponse.json({ success: true, message: "Notification marked as read" });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'markRead' with notificationId or 'markAllRead'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error updating notifications:", error);
    return NextResponse.json(
      { error: "Failed to update notifications", code: "UPDATE_ERROR" },
      { status: 500 }
    );
  }
});
