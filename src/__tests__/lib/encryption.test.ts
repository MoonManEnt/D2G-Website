import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

const originalEnv = process.env;

describe("Encryption Module", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      ENCRYPTION_KEY: "test-encryption-key-for-unit-tests-32chars\!",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function loadModule() {
    return require("@/lib/encryption") as typeof import("@/lib/encryption");
  }

  describe("encrypt / decrypt roundtrip", () => {
    it("should encrypt and decrypt a simple string", () => {
      const mod = loadModule();
      const plaintext = "Hello, World\!";
      const encrypted = mod.encrypt(plaintext);
      const decrypted = mod.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should produce different ciphertext than plaintext", () => {
      const mod = loadModule();
      const plaintext = "sensitive data";
      const encrypted = mod.encrypt(plaintext);
      expect(encrypted).not.toBe(plaintext);
    });

    it("should produce different ciphertext on each call (random IV)", () => {
      const mod = loadModule();
      const plaintext = "same input";
      const encrypted1 = mod.encrypt(plaintext);
      const encrypted2 = mod.encrypt(plaintext);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it("should handle empty string by returning it as-is", () => {
      const mod = loadModule();
      expect(mod.encrypt("")).toBe("");
      expect(mod.decrypt("")).toBe("");
    });

    it("should handle special characters", () => {
      const mod = loadModule();
      const plaintext = "\!@#$%^&*()_+-=[]{}|";
      const encrypted = mod.encrypt(plaintext);
      const decrypted = mod.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should handle unicode characters", () => {
      const mod = loadModule();
      const plaintext = "日本語テスト emojis cafe";
      const encrypted = mod.encrypt(plaintext);
      const decrypted = mod.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should handle long strings", () => {
      const mod = loadModule();
      const plaintext = "A".repeat(10000);
      const encrypted = mod.encrypt(plaintext);
      const decrypted = mod.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe("decrypt with wrong key", () => {
    it("should fail to decrypt data encrypted with a different key", () => {
      const mod1 = loadModule();
      const plaintext = "secret data";
      const encrypted = mod1.encrypt(plaintext);

      jest.resetModules();
      process.env = {
        ...process.env,
        ENCRYPTION_KEY: "different-key-entirely-different\!",
      };
      const mod2 = loadModule();

      expect(() => mod2.decrypt(encrypted)).toThrow();
    });
  });

  describe("decrypt with non-encrypted input", () => {
    it("should return non-encrypted value as-is (legacy support)", () => {
      const mod = loadModule();
      const legacyValue = "plain text without base64 colons";
      expect(mod.decrypt(legacyValue)).toBe(legacyValue);
    });
  });

  describe("isEncrypted", () => {
    it("should return true for encrypted values", () => {
      const mod = loadModule();
      const encrypted = mod.encrypt("test");
      expect(mod.isEncrypted(encrypted)).toBe(true);
    });

    it("should return false for plain text", () => {
      const mod = loadModule();
      expect(mod.isEncrypted("plain text")).toBe(false);
    });

    it("should return false for empty string", () => {
      const mod = loadModule();
      expect(mod.isEncrypted("")).toBe(false);
    });

    it("should return false for null-ish values", () => {
      const mod = loadModule();
      expect(mod.isEncrypted(null as unknown as string)).toBe(false);
      expect(mod.isEncrypted(undefined as unknown as string)).toBe(false);
    });
  });

  describe("missing ENCRYPTION_KEY", () => {
    it("should throw when ENCRYPTION_KEY is not set", () => {
      jest.resetModules();
      process.env = { ...originalEnv };
      delete process.env.ENCRYPTION_KEY;
      const mod = loadModule();
      expect(() => mod.encrypt("test")).toThrow("ENCRYPTION_KEY");
    });
  });

  describe("encryptPIIFields", () => {
    it("should encrypt known PII fields in an object", () => {
      const mod = loadModule();
      const data = {
        name: "John Doe",
        ssnLast4: "1234",
        dateOfBirth: "1990-01-01",
        phone: "555-1234",
        addressLine1: "123 Main St",
        email: "john@example.com",
      };

      const encrypted = mod.encryptPIIFields(data);

      expect(encrypted.name).toBe("John Doe");
      expect(encrypted.email).toBe("john@example.com");
      expect(encrypted.ssnLast4).not.toBe("1234");
      expect(encrypted.dateOfBirth).not.toBe("1990-01-01");
      expect(encrypted.phone).not.toBe("555-1234");
      expect(encrypted.addressLine1).not.toBe("123 Main St");
    });

    it("should skip null and undefined PII fields", () => {
      const mod = loadModule();
      const data = {
        name: "John",
        ssnLast4: null,
        dateOfBirth: undefined,
      };

      const encrypted = mod.encryptPIIFields(data);
      expect(encrypted.ssnLast4).toBeNull();
      expect(encrypted.dateOfBirth).toBeUndefined();
    });

    it("should not mutate the original object", () => {
      const mod = loadModule();
      const data = { ssnLast4: "1234" };
      const encrypted = mod.encryptPIIFields(data);
      expect(data.ssnLast4).toBe("1234");
      expect(encrypted.ssnLast4).not.toBe("1234");
    });

    it("should skip encryption when ENCRYPTION_KEY is missing", () => {
      jest.resetModules();
      process.env = { ...originalEnv };
      delete process.env.ENCRYPTION_KEY;
      const mod = loadModule();

      const data = { ssnLast4: "1234" };
      const result = mod.encryptPIIFields(data);
      expect(result.ssnLast4).toBe("1234");
    });
  });

  describe("decryptPIIFields", () => {
    it("should decrypt previously encrypted PII fields", () => {
      const mod = loadModule();
      const original = {
        name: "John Doe",
        ssnLast4: "1234",
        dateOfBirth: "1990-01-01",
        phone: "555-1234",
        addressLine1: "123 Main St",
        addressLine2: "Apt 4",
      };

      const encrypted = mod.encryptPIIFields(original);
      const decrypted = mod.decryptPIIFields(encrypted);

      expect(decrypted.name).toBe("John Doe");
      expect(decrypted.ssnLast4).toBe("1234");
      expect(decrypted.dateOfBirth).toBe("1990-01-01");
      expect(decrypted.phone).toBe("555-1234");
      expect(decrypted.addressLine1).toBe("123 Main St");
      expect(decrypted.addressLine2).toBe("Apt 4");
    });

    it("should handle legacy plaintext PII fields gracefully", () => {
      const mod = loadModule();
      const data = {
        ssnLast4: "1234",
        phone: mod.encrypt("555-1234"),
      };

      const decrypted = mod.decryptPIIFields(data);
      expect(decrypted.ssnLast4).toBe("1234");
      expect(decrypted.phone).toBe("555-1234");
    });

    it("should skip decryption when ENCRYPTION_KEY is missing", () => {
      jest.resetModules();
      process.env = { ...originalEnv };
      delete process.env.ENCRYPTION_KEY;
      const mod = loadModule();

      const data = { ssnLast4: "some-encrypted-value" };
      const result = mod.decryptPIIFields(data);
      expect(result.ssnLast4).toBe("some-encrypted-value");
    });
  });

  describe("PII_FIELDS constant", () => {
    it("should contain expected field names", () => {
      const mod = loadModule();
      expect(mod.PII_FIELDS).toContain("ssnLast4");
      expect(mod.PII_FIELDS).toContain("dateOfBirth");
      expect(mod.PII_FIELDS).toContain("phone");
      expect(mod.PII_FIELDS).toContain("addressLine1");
      expect(mod.PII_FIELDS).toContain("addressLine2");
    });
  });
});
