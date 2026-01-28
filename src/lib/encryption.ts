import crypto from "crypto";

// =============================================================================
// PII ENCRYPTION AT REST
// =============================================================================
// AES-256-GCM encryption for sensitive fields (SSN, DOB, etc.)
// Uses a 32-byte key derived from ENCRYPTION_KEY env var.
// Each encrypted value includes a random IV and auth tag for integrity.
// Format: iv:authTag:ciphertext (all base64-encoded)
// =============================================================================

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128-bit IV for GCM
const AUTH_TAG_LENGTH = 16;
const ENCODING = "base64" as const;
const SEPARATOR = ":";

/**
 * Get the encryption key (derived from env var).
 * Uses SHA-256 to ensure exactly 32 bytes regardless of input length.
 */
function getKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is required for PII encryption. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return crypto.createHash("sha256").update(envKey).digest();
}

/**
 * Encrypt a plaintext string.
 * Returns format: iv:authTag:ciphertext (base64-encoded parts)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", ENCODING);
  encrypted += cipher.final(ENCODING);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString(ENCODING),
    authTag.toString(ENCODING),
    encrypted,
  ].join(SEPARATOR);
}

/**
 * Decrypt an encrypted string (iv:authTag:ciphertext format).
 * Returns the original plaintext.
 */
export function decrypt(encryptedValue: string): string {
  if (!encryptedValue) return encryptedValue;

  // If value doesn't look encrypted (no separator), return as-is
  // This handles legacy unencrypted data during migration
  const parts = encryptedValue.split(SEPARATOR);
  if (parts.length !== 3) {
    return encryptedValue;
  }

  const key = getKey();
  const [ivB64, authTagB64, ciphertext] = parts;

  const iv = Buffer.from(ivB64, ENCODING);
  const authTag = Buffer.from(authTagB64, ENCODING);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, ENCODING, "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Check if a value appears to be encrypted (has the iv:tag:cipher format).
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  const parts = value.split(SEPARATOR);
  if (parts.length !== 3) return false;
  // Check each part is valid base64
  try {
    for (const part of parts) {
      Buffer.from(part, ENCODING);
    }
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// FIELD-LEVEL ENCRYPTION HELPERS
// =============================================================================

/** Fields that should be encrypted at rest */
export const PII_FIELDS = [
  "ssnLast4",
  "dateOfBirth",
  "phone",
  "addressLine1",
  "addressLine2",
] as const;

export type PIIField = (typeof PII_FIELDS)[number];

/**
 * Encrypt specific PII fields in an object before database write.
 * Only encrypts fields that are present and non-null.
 */
export function encryptPIIFields(data: Record<string, unknown>): Record<string, unknown> {
  if (!process.env.ENCRYPTION_KEY) return data; // Skip if no key configured

  const result = { ...data };
  for (const field of PII_FIELDS) {
    if (field in result && result[field] && typeof result[field] === "string") {
      result[field] = encrypt(result[field] as string);
    }
  }
  return result;
}

/**
 * Decrypt specific PII fields in an object after database read.
 * Handles both encrypted and legacy plaintext values gracefully.
 */
export function decryptPIIFields(data: Record<string, unknown>): Record<string, unknown> {
  if (!process.env.ENCRYPTION_KEY) return data; // Skip if no key configured

  const result = { ...data };
  for (const field of PII_FIELDS) {
    if (field in result && result[field] && typeof result[field] === "string") {
      const value = result[field] as string;
      if (isEncrypted(value)) {
        result[field] = decrypt(value);
      }
      // If not encrypted, it's legacy plaintext - leave as-is
    }
  }
  return result;
}
