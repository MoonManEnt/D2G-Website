/**
 * Unified Upload Validation
 *
 * This module provides consistent file upload validation across all routes.
 * Use this instead of implementing validation logic in each route.
 */

export interface UploadValidationOptions {
  /** Maximum file size in bytes. Default: 50MB */
  maxSizeBytes?: number;
  /** Allowed MIME types. Default: PDF only */
  allowedMimeTypes?: readonly string[];
  /** Allowed file extensions (without dot). Default: ["pdf"] */
  allowedExtensions?: readonly string[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedFileName?: string;
}

// Preset configurations for common upload types
export const UPLOAD_PRESETS = {
  /** Credit report PDFs - strict PDF only, 100MB max */
  creditReport: {
    maxSizeBytes: 100 * 1024 * 1024, // 100MB
    allowedMimeTypes: ["application/pdf"],
    allowedExtensions: ["pdf"],
  },

  /** Client documents - PDFs, images, Word docs, 50MB max */
  clientDocument: {
    maxSizeBytes: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ],
    allowedExtensions: ["pdf", "jpg", "jpeg", "png", "gif", "webp", "doc", "docx", "txt"],
  },

  /** Evidence screenshots - images only, 10MB max */
  evidenceScreenshot: {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    allowedExtensions: ["jpg", "jpeg", "png", "gif", "webp"],
  },
} as const;

/**
 * Validate an uploaded file against the specified options.
 */
export function validateUpload(
  file: { name: string; size: number; type: string },
  options: UploadValidationOptions = UPLOAD_PRESETS.creditReport
): ValidationResult {
  const {
    maxSizeBytes = 50 * 1024 * 1024,
    allowedMimeTypes = ["application/pdf"] as const,
    allowedExtensions = ["pdf"] as const,
  } = options;

  // Check file size
  if (file.size > maxSizeBytes) {
    const maxMB = Math.round(maxSizeBytes / (1024 * 1024));
    return {
      valid: false,
      error: `File size exceeds maximum allowed (${maxMB}MB)`,
    };
  }

  // Check MIME type
  if (!allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type "${file.type}" is not allowed. Allowed types: ${allowedMimeTypes.join(", ")}`,
    };
  }

  // Check file extension
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `File extension ".${extension}" is not allowed. Allowed extensions: ${allowedExtensions.join(", ")}`,
    };
  }

  // Sanitize filename
  const sanitizedFileName = sanitizeFileName(file.name);

  return {
    valid: true,
    sanitizedFileName,
  };
}

/**
 * Validate a base64 image string (for evidence uploads).
 */
export function validateBase64Image(
  imageData: string,
  options: { maxSizeBytes?: number } = {}
): ValidationResult {
  const { maxSizeBytes = 10 * 1024 * 1024 } = options;

  // Check format
  if (!imageData.startsWith("data:image/")) {
    return {
      valid: false,
      error: "Invalid image data format. Expected base64-encoded image.",
    };
  }

  // Extract image info
  const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) {
    return {
      valid: false,
      error: "Could not parse base64 image data.",
    };
  }

  const [, extension, base64Data] = matches;

  // Validate extension
  const allowedExtensions = ["png", "jpg", "jpeg", "gif", "webp"];
  if (!allowedExtensions.includes(extension.toLowerCase())) {
    return {
      valid: false,
      error: `Image type "${extension}" is not allowed. Allowed types: ${allowedExtensions.join(", ")}`,
    };
  }

  // Check approximate size (base64 is ~33% larger than binary)
  const estimatedSizeBytes = Math.ceil((base64Data.length * 3) / 4);
  if (estimatedSizeBytes > maxSizeBytes) {
    const maxMB = Math.round(maxSizeBytes / (1024 * 1024));
    return {
      valid: false,
      error: `Image size exceeds maximum allowed (${maxMB}MB)`,
    };
  }

  return {
    valid: true,
    sanitizedFileName: `image.${extension}`,
  };
}

/**
 * Sanitize a filename to prevent path traversal and other issues.
 */
export function sanitizeFileName(filename: string): string {
  // Remove path components
  const basename = filename.split(/[\\/]/).pop() || filename;

  // Remove problematic characters, keep alphanumeric, dots, hyphens, underscores
  const sanitized = basename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[._-]+/, "")
    .substring(0, 255);

  // Ensure we have a valid filename
  if (!sanitized || sanitized === "") {
    return `file_${Date.now()}`;
  }

  return sanitized;
}

/**
 * Generate a safe storage path for an uploaded file.
 */
export function generateStoragePath(
  organizationId: string,
  category: string,
  filename: string
): string {
  const timestamp = Date.now();
  const sanitized = sanitizeFileName(filename);
  const randomSuffix = Math.random().toString(36).substring(2, 8);

  return `uploads/${organizationId}/${category}/${timestamp}_${randomSuffix}_${sanitized}`;
}
