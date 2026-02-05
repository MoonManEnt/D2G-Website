import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

const mockCheckoutCreate = jest.fn();
const mockBillingPortalCreate = jest.fn();
const mockCustomersList = jest.fn();
const mockCustomersCreate = jest.fn();
const mockCustomersUpdate = jest.fn();
const mockSubscriptionsRetrieve = jest.fn();
const mockSubscriptionsCancel = jest.fn();
const mockSubscriptionsUpdate = jest.fn();
const mockConstructEvent = jest.fn();

const mockStripeInstance = {
  checkout: { sessions: { create: mockCheckoutCreate } },
  billingPortal: { sessions: { create: mockBillingPortalCreate } },
  customers: { list: mockCustomersList, create: mockCustomersCreate, update: mockCustomersUpdate },
  subscriptions: { retrieve: mockSubscriptionsRetrieve, cancel: mockSubscriptionsCancel, update: mockSubscriptionsUpdate },
  webhooks: { constructEvent: mockConstructEvent },
};

jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => mockStripeInstance);
});

const originalEnv = process.env;

describe("Stripe Module", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv, STRIPE_SECRET_KEY: "sk_test_123", STRIPE_WEBHOOK_SECRET: "whsec_test_123", STRIPE_PRO_MONTHLY_PRICE_ID: "price_monthly_123", STRIPE_PRO_YEARLY_PRICE_ID: "price_yearly_123" };
  });
  afterEach(() => { process.env = originalEnv; });
  function loadModule() { return require("@/lib/stripe") as typeof import("@/lib/stripe"); }

  describe("createCheckoutSession", () => {
    it("should create with trial period", async () => {
      mockCheckoutCreate.mockResolvedValue({ url: "https://checkout.stripe.com/s-123" });
      const mod = loadModule();
      const url = await mod.createCheckoutSession("cus_123","price_monthly_123","https://app.com/success","https://app.com/cancel","org_123");
      expect(url).toBe("https://checkout.stripe.com/s-123");
      expect(mockCheckoutCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_123", mode: "subscription", payment_method_types: ["card"], line_items: [{ price: "price_monthly_123", quantity: 1 }], subscription_data: expect.objectContaining({ trial_period_days: 14 }), allow_promotion_codes: true }));
    });
    it("should return null on error", async () => {
      mockCheckoutCreate.mockRejectedValue(new Error("Stripe error"));
      const url = await loadModule().createCheckoutSession("cus_123","p","s","c","o");
      expect(url).toBeNull();
    });
    it("should return null when not configured", async () => {
      jest.resetModules();
      process.env = { ...originalEnv };
      delete process.env.STRIPE_SECRET_KEY;
      jest.mock("stripe", () => jest.fn().mockImplementation(() => mockStripeInstance));
      const url = await loadModule().createCheckoutSession("cus_123","p","s","c","o");
      expect(url).toBeNull();
    });
  });

  describe("createPortalSession", () => {
    it("should create a billing portal session", async () => {
      mockBillingPortalCreate.mockResolvedValue({ url: "https://billing.stripe.com/p-123" });
      const url = await loadModule().createPortalSession("cus_123","https://app.com/settings");
      expect(url).toBe("https://billing.stripe.com/p-123");
      expect(mockBillingPortalCreate).toHaveBeenCalledWith({ customer: "cus_123", return_url: "https://app.com/settings" });
    });
    it("should return null on error", async () => {
      mockBillingPortalCreate.mockRejectedValue(new Error("Portal error"));
      expect(await loadModule().createPortalSession("cus_123","https://app.com/settings")).toBeNull();
    });
  });

  describe("getOrCreateCustomer", () => {
    it("should return existing customer", async () => {
      mockCustomersList.mockResolvedValue({ data: [{ id: "cus_existing" }] });
      mockCustomersUpdate.mockResolvedValue({});
      const id = await loadModule().getOrCreateCustomer("org_123","user@example.com","Test User");
      expect(id).toBe("cus_existing");
      expect(mockCustomersList).toHaveBeenCalledWith({ email: "user@example.com", limit: 1 });
    });
    it("should create new customer", async () => {
      mockCustomersList.mockResolvedValue({ data: [] });
      mockCustomersCreate.mockResolvedValue({ id: "cus_new" });
      const id = await loadModule().getOrCreateCustomer("org_123","new@example.com","New User");
      expect(id).toBe("cus_new");
    });
    it("should return null on error", async () => {
      mockCustomersList.mockRejectedValue(new Error("API error"));
      expect(await loadModule().getOrCreateCustomer("org_123","u@e.com","U")).toBeNull();
    });
  });

  describe("getSubscription", () => {
    it("should retrieve", async () => {
      const ms = { id: "sub_123", status: "active" };
      mockSubscriptionsRetrieve.mockResolvedValue(ms);
      expect(await loadModule().getSubscription("sub_123")).toEqual(ms);
    });
    it("should return null on error", async () => {
      mockSubscriptionsRetrieve.mockRejectedValue(new Error("Not found"));
      expect(await loadModule().getSubscription("sub_x")).toBeNull();
    });
  });

  describe("cancelSubscription", () => {
    it("should cancel at period end by default", async () => {
      mockSubscriptionsUpdate.mockResolvedValue({});
      expect(await loadModule().cancelSubscription("sub_123")).toBe(true);
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith("sub_123", { cancel_at_period_end: true });
    });
    it("should cancel immediately", async () => {
      mockSubscriptionsCancel.mockResolvedValue({});
      expect(await loadModule().cancelSubscription("sub_123", true)).toBe(true);
      expect(mockSubscriptionsCancel).toHaveBeenCalledWith("sub_123");
    });
    it("should return false on error", async () => {
      mockSubscriptionsUpdate.mockRejectedValue(new Error("e"));
      expect(await loadModule().cancelSubscription("sub_123")).toBe(false);
    });
  });

  describe("constructWebhookEvent", () => {
    it("should verify signature", () => {
      const me = { id: "evt_123", type: "checkout.session.completed" };
      mockConstructEvent.mockReturnValue(me);
      const event = loadModule().constructWebhookEvent('{"id":"evt_123"}', "sig_val");
      expect(event).toEqual(me);
      expect(mockConstructEvent).toHaveBeenCalledWith('{"id":"evt_123"}', "sig_val", "whsec_test_123");
    });
    it("should return null on bad signature", () => {
      mockConstructEvent.mockImplementation(() => { throw new Error("Invalid sig"); });
      expect(loadModule().constructWebhookEvent('{"id":"e"}', "bad")).toBeNull();
    });
    it("should return null without webhook secret", () => {
      jest.resetModules();
      process.env = { ...process.env };
      delete process.env.STRIPE_WEBHOOK_SECRET;
      jest.mock("stripe", () => jest.fn().mockImplementation(() => mockStripeInstance));
      expect(loadModule().constructWebhookEvent('{"id":"e"}', "sig")).toBeNull();
    });
  });

  describe("mapSubscriptionStatus", () => {
    it("maps active to ACTIVE", () => { expect(loadModule().mapSubscriptionStatus("active" as any)).toBe("ACTIVE"); });
    it("maps trialing to ACTIVE", () => { expect(loadModule().mapSubscriptionStatus("trialing" as any)).toBe("ACTIVE"); });
    it("maps past_due to PAST_DUE", () => { expect(loadModule().mapSubscriptionStatus("past_due" as any)).toBe("PAST_DUE"); });
    it("maps canceled to CANCELED", () => { expect(loadModule().mapSubscriptionStatus("canceled" as any)).toBe("CANCELED"); });
    it("maps unpaid to CANCELED", () => { expect(loadModule().mapSubscriptionStatus("unpaid" as any)).toBe("CANCELED"); });
    it("maps incomplete to INCOMPLETE", () => { expect(loadModule().mapSubscriptionStatus("incomplete" as any)).toBe("INCOMPLETE"); });
    it("maps incomplete_expired to INCOMPLETE", () => { expect(loadModule().mapSubscriptionStatus("incomplete_expired" as any)).toBe("INCOMPLETE"); });
    it("maps unknown to UNKNOWN", () => { expect(loadModule().mapSubscriptionStatus("paused" as any)).toBe("UNKNOWN"); });
  });

  describe("TRIAL_DAYS", () => {
    it("should be 14", () => { expect(loadModule().TRIAL_DAYS).toBe(14); });
  });

  describe("PLAN_FEATURES", () => {
    it("should have all plans", () => {
      const pf = loadModule().PLAN_FEATURES;
      expect(pf.FREE).toBeDefined();
      expect(pf.STARTER).toBeDefined();
      expect(pf.PROFESSIONAL).toBeDefined();
      expect(pf.ENTERPRISE).toBeDefined();
      expect(pf.PRO).toBeDefined();
    });
    it("FREE plan 3 clients", () => { expect(loadModule().PLAN_FEATURES.FREE.limits.clients).toBe(3); });
    it("ENTERPRISE unlimited", () => {
      const e = loadModule().PLAN_FEATURES.ENTERPRISE.limits;
      expect(e.clients).toBe(Infinity);
      expect(e.reportsPerMonth).toBe(Infinity);
    });
  });
});
