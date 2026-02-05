import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

// Mock Resend before importing the module
const mockSend = jest.fn();
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

// Mock prisma
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    organization: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  },
}));

// Mock email-templates
jest.mock("@/lib/email-templates", () => ({
  portalInviteTemplate: jest.fn().mockReturnValue("<html>portal invite</html>"),
  disputeCreatedTemplate: jest.fn().mockReturnValue("<html>dispute created</html>"),
  disputeStatusUpdateTemplate: jest.fn().mockReturnValue("<html>status update</html>"),
  deadlineReminderTemplate: jest.fn().mockReturnValue("<html>deadline reminder</html>"),
  scoreChangeTemplate: jest.fn().mockReturnValue("<html>score change</html>"),
  passwordResetTemplate: jest.fn().mockReturnValue("<html>password reset</html>"),
  welcomeTemplate: jest.fn().mockReturnValue("<html>welcome</html>"),
  documentReadyTemplate: jest.fn().mockReturnValue("<html>document ready</html>"),
}));

const originalEnv = process.env;

describe("Email Module", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      RESEND_API_KEY: "re_test_123456",
      EMAIL_FROM: "test@dispute2go.com",
      EMAIL_REPLY_TO: "support@dispute2go.com",
      APP_URL: "https://app.dispute2go.com",
      PORTAL_URL: "https://portal.dispute2go.com",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function loadModule() {
    return require("@/lib/email") as typeof import("@/lib/email");
  }

  describe("sendEmail", () => {
    it("should send email with correct parameters", async () => {
      mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
      const mod = loadModule();

      const result = await mod.sendEmail({
        to: "user@example.com",
        template: {
          subject: "Test Subject",
          html: "<p>Hello</p>",
          text: "Hello",
        },
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe("email-123");
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["user@example.com"],
          subject: "Test Subject",
          html: "<p>Hello</p>",
          text: "Hello",
        })
      );
    });

    it("should convert single email to array", async () => {
      mockSend.mockResolvedValue({ data: { id: "email-456" }, error: null });
      const mod = loadModule();

      await mod.sendEmail({
        to: "single@example.com",
        template: { subject: "Test", html: "<p>Hi</p>", text: "Hi" },
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["single@example.com"],
        })
      );
    });

    it("should pass array of emails as-is", async () => {
      mockSend.mockResolvedValue({ data: { id: "email-789" }, error: null });
      const mod = loadModule();

      await mod.sendEmail({
        to: ["a@example.com", "b@example.com"],
        template: { subject: "Test", html: "<p>Hi</p>", text: "Hi" },
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["a@example.com", "b@example.com"],
        })
      );
    });

    it("should return error when Resend API returns an error", async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { message: "Rate limit exceeded" },
      });
      const mod = loadModule();

      const result = await mod.sendEmail({
        to: "user@example.com",
        template: { subject: "Test", html: "<p>Hi</p>", text: "Hi" },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Rate limit exceeded");
    });

    it("should handle API exceptions", async () => {
      mockSend.mockRejectedValue(new Error("Network error"));
      const mod = loadModule();

      const result = await mod.sendEmail({
        to: "user@example.com",
        template: { subject: "Test", html: "<p>Hi</p>", text: "Hi" },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("should include tags when provided", async () => {
      mockSend.mockResolvedValue({ data: { id: "email-tag" }, error: null });
      const mod = loadModule();

      await mod.sendEmail({
        to: "user@example.com",
        template: { subject: "Test", html: "<p>Hi</p>", text: "Hi" },
        tags: [{ name: "category", value: "test" }],
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: [{ name: "category", value: "test" }],
        })
      );
    });
  });

  describe("sendEmail without Resend configured", () => {
    it("should return error when RESEND_API_KEY is not set", async () => {
      jest.resetModules();
      jest.clearAllMocks();
      process.env = { ...originalEnv };
      delete process.env.RESEND_API_KEY;

      jest.mock("resend", () => ({
        Resend: jest.fn().mockImplementation(() => ({
          emails: { send: mockSend },
        })),
      }));
      jest.mock("@/lib/prisma", () => ({
        __esModule: true,
        default: {
          organization: { findUnique: jest.fn().mockResolvedValue(null) },
        },
      }));
      jest.mock("@/lib/email-templates", () => ({
        portalInviteTemplate: jest.fn().mockReturnValue("<html></html>"),
        disputeCreatedTemplate: jest.fn().mockReturnValue("<html></html>"),
        disputeStatusUpdateTemplate: jest.fn().mockReturnValue("<html></html>"),
        deadlineReminderTemplate: jest.fn().mockReturnValue("<html></html>"),
        scoreChangeTemplate: jest.fn().mockReturnValue("<html></html>"),
        passwordResetTemplate: jest.fn().mockReturnValue("<html></html>"),
        welcomeTemplate: jest.fn().mockReturnValue("<html></html>"),
        documentReadyTemplate: jest.fn().mockReturnValue("<html></html>"),
      }));

      const mod = loadModule();
      const result = await mod.sendEmail({
        to: "user@example.com",
        template: { subject: "Test", html: "<p>Hi</p>", text: "Hi" },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Email service not configured");
    });
  });

  describe("template generators", () => {
    it("portalInviteEmail should create template with correct subject", () => {
      const mod = loadModule();
      const template = mod.portalInviteEmail(
        "John Doe",
        "Credit Corp",
        "token-123"
      );
      expect(template.subject).toContain("Credit Corp");
      expect(template.text).toContain("John Doe");
      expect(template.text).toContain("token-123");
    });

    it("disputeCreatedEmail should include CRA and account count", () => {
      const mod = loadModule();
      const template = mod.disputeCreatedEmail(
        "Jane Smith",
        "Equifax",
        3,
        "dispute-abc"
      );
      expect(template.subject).toContain("Equifax");
      expect(template.text).toContain("Equifax");
      expect(template.text).toContain("3");
    });

    it("disputeStatusUpdateEmail should include old and new status", () => {
      const mod = loadModule();
      const template = mod.disputeStatusUpdateEmail(
        "Client",
        "TransUnion",
        "PENDING",
        "IN_REVIEW",
        "Your dispute is being reviewed",
        "dispute-xyz"
      );
      expect(template.subject).toContain("IN REVIEW");
      expect(template.text).toContain("PENDING");
    });

    it("deadlineReminderEmail should include days remaining", () => {
      const mod = loadModule();
      const template = mod.deadlineReminderEmail(
        "Client",
        "Experian",
        5,
        "2024-01-01",
        "2024-01-31",
        "dispute-dl"
      );
      expect(template.subject).toContain("5 days");
      expect(template.text).toContain("5");
    });

    it("scoreChangeEmail should handle positive change", () => {
      const mod = loadModule();
      const template = mod.scoreChangeEmail(
        "Client",
        "Equifax",
        680,
        710,
        30
      );
      expect(template.subject).toContain("increased");
      expect(template.subject).toContain("30");
      expect(template.text).toContain("+30");
    });

    it("scoreChangeEmail should handle negative change", () => {
      const mod = loadModule();
      const template = mod.scoreChangeEmail(
        "Client",
        "Equifax",
        710,
        680,
        -30
      );
      expect(template.subject).toContain("decreased");
      expect(template.text).toContain("-30");
    });

    it("passwordResetEmail should include reset link", () => {
      const mod = loadModule();
      const template = mod.passwordResetEmail("User", "reset-token-abc");
      expect(template.subject).toContain("Reset");
      expect(template.text).toContain("reset-token-abc");
    });

    it("welcomeEmail should include organization name", () => {
      const mod = loadModule();
      const template = mod.welcomeEmail("User", "My Company");
      expect(template.subject).toContain("My Company");
      expect(template.text).toContain("User");
    });

    it("documentReadyEmail should include document info", () => {
      const mod = loadModule();
      const template = mod.documentReadyEmail(
        "Client",
        "Dispute Letter",
        "Equifax Letter #1",
        "doc-123"
      );
      expect(template.subject).toContain("Dispute Letter");
      expect(template.text).toContain("Equifax Letter #1");
    });
  });
});
