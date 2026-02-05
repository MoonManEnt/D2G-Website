import { describe, it, expect } from "@jest/globals";
import {
  sanitizeInput,
} from "@/lib/validation";

describe("Validation Functions", () => {
  describe("sanitizeInput", () => {
    it("should remove angle brackets", () => {
      expect(sanitizeInput("<script>alert('xss')</script>")).toBe("scriptalert('xss')/script");
      expect(sanitizeInput("<b>bold</b> text")).toBe("bbold/b text");
    });

    it("should trim whitespace", () => {
      expect(sanitizeInput("  hello  ")).toBe("hello");
    });

    it("should handle empty input", () => {
      expect(sanitizeInput("")).toBe("");
    });
  });
});
