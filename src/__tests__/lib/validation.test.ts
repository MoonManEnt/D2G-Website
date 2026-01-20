import { describe, it, expect } from "@jest/globals";
import {
  validateEmail,
  validatePhone,
  validateSSNLast4,
  validateZipCode,
  sanitizeInput,
} from "@/lib/validation";

describe("Validation Functions", () => {
  describe("validateEmail", () => {
    it("should validate correct email addresses", () => {
      expect(validateEmail("test@example.com").success).toBe(true);
      expect(validateEmail("user.name@domain.co.uk").success).toBe(true);
      expect(validateEmail("test+alias@gmail.com").success).toBe(true);
    });

    it("should reject invalid email addresses", () => {
      expect(validateEmail("not-an-email").success).toBe(false);
      expect(validateEmail("@missing-local.com").success).toBe(false);
      expect(validateEmail("missing-domain@").success).toBe(false);
      expect(validateEmail("").success).toBe(false);
    });
  });

  describe("validatePhone", () => {
    it("should validate correct phone numbers", () => {
      expect(validatePhone("(555) 123-4567").success).toBe(true);
      expect(validatePhone("555-123-4567").success).toBe(true);
      expect(validatePhone("5551234567").success).toBe(true);
      expect(validatePhone("+1 555 123 4567").success).toBe(true);
    });

    it("should reject invalid phone numbers", () => {
      expect(validatePhone("123").success).toBe(false);
      expect(validatePhone("not-a-phone").success).toBe(false);
    });
  });

  describe("validateSSNLast4", () => {
    it("should validate correct SSN last 4", () => {
      expect(validateSSNLast4("1234").success).toBe(true);
      expect(validateSSNLast4("0000").success).toBe(true);
      expect(validateSSNLast4("9999").success).toBe(true);
    });

    it("should reject invalid SSN last 4", () => {
      expect(validateSSNLast4("123").success).toBe(false);
      expect(validateSSNLast4("12345").success).toBe(false);
      expect(validateSSNLast4("abcd").success).toBe(false);
    });
  });

  describe("validateZipCode", () => {
    it("should validate correct ZIP codes", () => {
      expect(validateZipCode("12345").success).toBe(true);
      expect(validateZipCode("12345-6789").success).toBe(true);
    });

    it("should reject invalid ZIP codes", () => {
      expect(validateZipCode("1234").success).toBe(false);
      expect(validateZipCode("123456").success).toBe(false);
      expect(validateZipCode("abcde").success).toBe(false);
    });
  });

  describe("sanitizeInput", () => {
    it("should remove HTML tags", () => {
      expect(sanitizeInput("<script>alert('xss')</script>")).toBe("alert('xss')");
      expect(sanitizeInput("<b>bold</b> text")).toBe("bold text");
    });

    it("should trim whitespace", () => {
      expect(sanitizeInput("  hello  ")).toBe("hello");
    });

    it("should handle empty input", () => {
      expect(sanitizeInput("")).toBe("");
    });
  });
});
