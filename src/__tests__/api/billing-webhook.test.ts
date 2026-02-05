/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, beforeAll, jest } from "@jest/globals";

// =============================================================================
// MOCKS
// =============================================================================

// Mock logger first to prevent pino import issues
const mockLogFn = jest.fn();
jest.mock("@/lib/logger", () => ({
  createLogger: jest.fn().mockReturnValue({
    info: mockLogFn, error: mockLogFn, warn: mockLogFn, debug: mockLogFn,
    child: jest.fn().mockReturnValue({ info: mockLogFn, error: mockLogFn, warn: mockLogFn, debug: mockLogFn }),
  }),
  logger: { info: mockLogFn, error: mockLogFn, warn: mockLogFn, debug: mockLogFn },
}));

const mockPrisma = {
  organization: {
    update: jest.fn().mockResolvedValue({} as never),
    findFirst: jest.fn(),
    count: jest.fn().mockResolvedValue(0 as never),
  },
  eventLog: {
    create: jest.fn().mockResolvedValue({} as never),
  },
  user: {
    findFirst: jest.fn(),
  },
};

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

const mockConstructWebhookEvent = jest.fn();
const mockMapSubscriptionStatus = jest.fn();

jest.mock("@/lib/stripe", () => ({
  constructWebhookEvent: mockConstructWebhookEvent,
  mapSubscriptionStatus: mockMapSubscriptionStatus,
}));

const mockSendEmail = jest.fn().mockResolvedValue({ success: true } as never);
jest.mock("@/lib/email", () => ({
  sendEmail: mockSendEmail,
}));

jest.mock("@/lib/email-templates", () => ({
  paymentFailedTemplate: jest.fn().mockReturnValue("<html>Payment failed</html>"),
}));

// Mock next/headers — synchronous function returning a Map-like object
const mockHeadersMap = new Map<string, string>();
jest.mock("next/headers", () => ({
  headers: jest.fn(() => mockHeadersMap),
  cookies: jest.fn(() => ({
    get: jest.fn(), getAll: jest.fn().mockReturnValue([]),
    set: jest.fn(), delete: jest.fn(), has: jest.fn().mockReturnValue(false),
  })),
}));

// =============================================================================
// IMPORTS
// =============================================================================

import { NextRequest } from "next/server";

let POST: any;
beforeAll(async () => {
  const mod = await import("@/app/api/billing/webhook/route");
  POST = mod.POST;
});

// =============================================================================
// HELPERS
// =============================================================================

function createWebhookRequest(body: string, signature?: string): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (signature) {
    headers["stripe-signature"] = signature;
  }
  return new NextRequest("http://localhost:3000/api/billing/webhook", {
    method: "POST",
    body,
    headers,
  });
}

function makeStripeEvent(type: string, data: any) {
  return { id: "evt_test", type, data: { object: data } };
}

// =============================================================================
// TESTS
// =============================================================================

describe("API /api/billing/webhook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHeadersMap.clear();
  });

  it("rejects requests without stripe-signature header", async () => {
    // Don't set stripe-signature in headers map
    const req = createWebhookRequest(JSON.stringify({ test: true }));
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Missing stripe-signature header");
  });

  it("rejects invalid webhook signature", async () => {
    mockHeadersMap.set("stripe-signature", "invalid-sig");
    mockConstructWebhookEvent.mockReturnValue(null);
    const req = createWebhookRequest(JSON.stringify({ test: true }), "invalid-sig");
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid webhook signature");
  });

  it("handles checkout.session.completed - updates org subscription", async () => {
    mockHeadersMap.set("stripe-signature", "valid-sig");
    const session = {
      id: "cs_test",
      metadata: { organizationId: "org-123", tier: "PROFESSIONAL" },
      subscription: "sub_test_123",
    };
    mockConstructWebhookEvent.mockReturnValue(makeStripeEvent("checkout.session.completed", session));
    // Founding member count — 0 means this org qualifies as founding member #1
    mockPrisma.organization.count.mockResolvedValue(0 as never);

    const req = createWebhookRequest(JSON.stringify({}), "valid-sig");
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);

    expect(mockPrisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-123" },
      data: {
        stripeSubscriptionId: "sub_test_123",
        subscriptionTier: "PROFESSIONAL",
        subscriptionStatus: "ACTIVE",
        isFoundingMember: true,
        foundingMemberNumber: 1,
        foundingMemberLockedPrice: 149.0,
      },
    });
    expect(mockPrisma.eventLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "SUBSCRIPTION_CREATED",
          targetId: "org-123",
        }),
      })
    );
  });

  it("handles checkout.session.completed - STARTER tier (no founding member)", async () => {
    mockHeadersMap.set("stripe-signature", "valid-sig");
    const session = {
      id: "cs_test_starter",
      metadata: { organizationId: "org-456", tier: "STARTER" },
      subscription: "sub_starter_123",
    };
    mockConstructWebhookEvent.mockReturnValue(makeStripeEvent("checkout.session.completed", session));

    const req = createWebhookRequest(JSON.stringify({}), "valid-sig");
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-456" },
      data: {
        stripeSubscriptionId: "sub_starter_123",
        subscriptionTier: "STARTER",
        subscriptionStatus: "ACTIVE",
        isFoundingMember: false,
        foundingMemberNumber: null,
        foundingMemberLockedPrice: null,
      },
    });
  });

  it("handles customer.subscription.updated", async () => {
    mockHeadersMap.set("stripe-signature", "valid-sig");
    const subscription = {
      id: "sub_test_456",
      status: "active",
      cancel_at_period_end: false,
      metadata: { organizationId: "org-456", tier: "PROFESSIONAL" },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeStripeEvent("customer.subscription.updated", subscription)
    );
    mockMapSubscriptionStatus.mockReturnValue("ACTIVE");

    const req = createWebhookRequest(JSON.stringify({}), "valid-sig");
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-456" },
      data: {
        stripeSubscriptionId: "sub_test_456",
        subscriptionStatus: "ACTIVE",
        subscriptionTier: "PROFESSIONAL",
      },
    });
  });

  it("handles customer.subscription.updated - finds org by subscription ID when no metadata", async () => {
    mockHeadersMap.set("stripe-signature", "valid-sig");
    const subscription = {
      id: "sub_test_789",
      status: "active",
      cancel_at_period_end: false,
      metadata: {},
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeStripeEvent("customer.subscription.updated", subscription)
    );
    mockPrisma.organization.findFirst.mockResolvedValue({ id: "org-found" } as never);
    mockMapSubscriptionStatus.mockReturnValue("ACTIVE");

    const req = createWebhookRequest(JSON.stringify({}), "valid-sig");
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: "sub_test_789" },
    });
    expect(mockPrisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "org-found" },
      })
    );
  });

  it("handles customer.subscription.deleted - downgrades to free", async () => {
    mockHeadersMap.set("stripe-signature", "valid-sig");
    const subscription = {
      id: "sub_del_123",
      metadata: { organizationId: "org-del" },
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeStripeEvent("customer.subscription.deleted", subscription)
    );

    const req = createWebhookRequest(JSON.stringify({}), "valid-sig");
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-del" },
      data: {
        subscriptionTier: "FREE",
        subscriptionStatus: "CANCELED",
        stripeSubscriptionId: null,
      },
    });
    expect(mockPrisma.eventLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "SUBSCRIPTION_CANCELED",
          targetId: "org-del",
        }),
      })
    );
  });

  it("handles invoice.payment_failed - sends email notification", async () => {
    mockHeadersMap.set("stripe-signature", "valid-sig");
    const invoice = {
      id: "inv_fail_1",
      customer: "cus_test_123",
      amount_due: 9900,
      attempt_count: 1,
      next_payment_attempt: Math.floor(Date.now() / 1000) + 86400,
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeStripeEvent("invoice.payment_failed", invoice)
    );

    mockPrisma.organization.findFirst.mockResolvedValue({
      id: "org-pay-fail",
      stripeCustomerId: "cus_test_123",
    } as never);

    mockPrisma.user.findFirst.mockResolvedValue({
      email: "owner@example.com",
      name: "Test Owner",
    } as never);

    const req = createWebhookRequest(JSON.stringify({}), "valid-sig");
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-pay-fail" },
      data: { subscriptionStatus: "PAST_DUE" },
    });
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@example.com",
        tags: [{ name: "category", value: "payment-failed" }],
      })
    );
  });

  it("returns 200 for unhandled event types", async () => {
    mockHeadersMap.set("stripe-signature", "valid-sig");
    mockConstructWebhookEvent.mockReturnValue(
      makeStripeEvent("some.unknown.event", { id: "test" })
    );

    const req = createWebhookRequest(JSON.stringify({}), "valid-sig");
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
  });

  it("handles subscription deleted - finds org by subscription ID when no metadata", async () => {
    mockHeadersMap.set("stripe-signature", "valid-sig");
    const subscription = {
      id: "sub_del_no_meta",
      metadata: {},
    };
    mockConstructWebhookEvent.mockReturnValue(
      makeStripeEvent("customer.subscription.deleted", subscription)
    );
    mockPrisma.organization.findFirst.mockResolvedValue({ id: "org-found-del" } as never);

    const req = createWebhookRequest(JSON.stringify({}), "valid-sig");
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: "sub_del_no_meta" },
    });
    expect(mockPrisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-found-del" },
      data: {
        subscriptionTier: "FREE",
        subscriptionStatus: "CANCELED",
        stripeSubscriptionId: null,
      },
    });
  });
});
