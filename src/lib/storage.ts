import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "crypto";
import fs from "fs/promises";
import path from "path";
import { createLogger } from "./logger";
const log = createLogger("storage");

// Storage provider type
export type StorageProvider = "local" | "s3" | "r2";

// Get current storage provider from env
export function getStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER || "local";
  if (provider === "s3" || provider === "r2") return provider;
  return "local";
}

// S3/R2 client configuration
function getS3Client(): S3Client | null {
  const provider = getStorageProvider();

  if (provider === "local") return null;

  // For Cloudflare R2
  if (provider === "r2") {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
      log.warn("R2 credentials not configured, falling back to local storage");
      return null;
    }

    return new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  // For AWS S3
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || "us-east-1";

  if (!accessKeyId || !secretAccessKey) {
    log.warn("S3 credentials not configured, falling back to local storage");
    return null;
  }

  return new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

// Get bucket name
function getBucket(): string {
  return process.env.STORAGE_BUCKET || "dispute2go-uploads";
}

// Generate a unique file key
export function generateFileKey(
  organizationId: string,
  type: "reports" | "evidence" | "documents" | "profiles",
  filename: string
): string {
  const ext = path.extname(filename);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${organizationId}/${type}/${timestamp}-${random}${ext}`;
}

// Calculate checksum for file
export function calculateChecksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export interface UploadResult {
  key: string;
  url: string;
  provider: StorageProvider;
  checksum: string;
  size: number;
}

export interface StorageFile {
  key: string;
  buffer: Buffer;
  contentType: string;
  size: number;
}

/**
 * Upload a file to storage
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<UploadResult> {
  const provider = getStorageProvider();
  const checksum = calculateChecksum(buffer);
  const size = buffer.length;

  // Try cloud storage first
  const s3Client = getS3Client();

  if (s3Client) {
    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: getBucket(),
          Key: key,
          Body: buffer,
          ContentType: contentType,
          ChecksumSHA256: checksum,
          Metadata: {
            checksum,
          },
        })
      );

      // Generate URL (for R2, use public URL if configured)
      let url: string;
      if (provider === "r2" && process.env.R2_PUBLIC_URL) {
        url = `${process.env.R2_PUBLIC_URL}/${key}`;
      } else {
        // Generate a presigned URL for S3
        url = await getSignedUrl(
          s3Client,
          new GetObjectCommand({ Bucket: getBucket(), Key: key }),
          { expiresIn: 3600 * 24 * 7 } // 7 days
        );
      }

      return { key, url, provider, checksum, size };
    } catch (error) {
      log.error({ err: error }, "Cloud storage upload failed, falling back to local");
    }
  }

  // Fallback to local storage
  const localDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
  const filePath = path.join(localDir, key);

  // Ensure directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  // Write file
  await fs.writeFile(filePath, buffer);

  return {
    key,
    url: `/uploads/${key}`,
    provider: "local",
    checksum,
    size,
  };
}

/**
 * Get a file from storage
 */
export async function getFile(key: string): Promise<StorageFile | null> {
  const s3Client = getS3Client();

  if (s3Client) {
    try {
      const response = await s3Client.send(
        new GetObjectCommand({
          Bucket: getBucket(),
          Key: key,
        })
      );

      const buffer = Buffer.from(await response.Body!.transformToByteArray());

      return {
        key,
        buffer,
        contentType: response.ContentType || "application/octet-stream",
        size: response.ContentLength || buffer.length,
      };
    } catch (error) {
      log.error({ err: error }, "Cloud storage get failed, trying local");
    }
  }

  // Try local storage
  const localDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
  const filePath = path.join(localDir, key);

  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(key).toLowerCase();
    const contentType = getContentType(ext);

    return {
      key,
      buffer,
      contentType,
      size: buffer.length,
    };
  } catch {
    return null;
  }
}

/**
 * Delete a file from storage
 */
export async function deleteFile(key: string): Promise<boolean> {
  const s3Client = getS3Client();

  if (s3Client) {
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: getBucket(),
          Key: key,
        })
      );
      return true;
    } catch (error) {
      log.error({ err: error }, "Cloud storage delete failed");
    }
  }

  // Try local storage
  const localDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
  const filePath = path.join(localDir, key);

  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(key: string): Promise<boolean> {
  const s3Client = getS3Client();

  if (s3Client) {
    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: getBucket(),
          Key: key,
        })
      );
      return true;
    } catch {
      // File doesn't exist in cloud
    }
  }

  // Check local storage
  const localDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
  const filePath = path.join(localDir, key);

  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get a signed URL for temporary file access
 */
export async function getSignedFileUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string | null> {
  const s3Client = getS3Client();

  if (s3Client) {
    try {
      return await getSignedUrl(
        s3Client,
        new GetObjectCommand({ Bucket: getBucket(), Key: key }),
        { expiresIn }
      );
    } catch (error) {
      log.error({ err: error }, "Failed to generate signed URL");
    }
  }

  // For local storage, return the public path
  return `/uploads/${key}`;
}

/**
 * Get content type from extension
 */
function getContentType(ext: string): string {
  const types: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".txt": "text/plain",
    ".json": "application/json",
  };
  return types[ext] || "application/octet-stream";
}

/**
 * Migrate a file from local to cloud storage
 */
export async function migrateToCloud(localPath: string, key: string): Promise<UploadResult | null> {
  const s3Client = getS3Client();
  if (!s3Client) return null;

  try {
    const buffer = await fs.readFile(localPath);
    const ext = path.extname(localPath).toLowerCase();
    const contentType = getContentType(ext);

    const result = await uploadFile(buffer, key, contentType);

    // If upload succeeded and is cloud, delete local file
    if (result.provider !== "local") {
      await fs.unlink(localPath).catch(() => {});
    }

    return result;
  } catch (error) {
    log.error({ err: error }, "Migration failed");
    return null;
  }
}
