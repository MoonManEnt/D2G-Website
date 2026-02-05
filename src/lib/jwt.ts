import { SignJWT, jwtVerify, JWTPayload } from "jose";
import { createLogger } from "./logger";
const log = createLogger("jwt");

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "fallback-secret-change-in-production"
);

const JWT_ISSUER = "dispute2go";
const JWT_AUDIENCE = "dispute2go-portal";

export interface PortalTokenPayload extends JWTPayload {
  sub: string; // clientId
  email: string;
  portalAccessId: string;
  organizationId: string;
  type: "portal";
}

export interface PortalRefreshPayload extends JWTPayload {
  sub: string;
  portalAccessId: string;
  type: "refresh";
}

/**
 * Sign a JWT token for client portal access
 */
export async function signPortalToken(payload: {
  clientId: string;
  email: string;
  portalAccessId: string;
  organizationId: string;
}): Promise<string> {
  const token = await new SignJWT({
    sub: payload.clientId,
    email: payload.email,
    portalAccessId: payload.portalAccessId,
    organizationId: payload.organizationId,
    type: "portal",
  } as PortalTokenPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime("1h") // Access token expires in 1 hour
    .sign(JWT_SECRET);

  return token;
}

/**
 * Sign a refresh token for client portal
 */
export async function signRefreshToken(payload: {
  clientId: string;
  portalAccessId: string;
}): Promise<string> {
  const token = await new SignJWT({
    sub: payload.clientId,
    portalAccessId: payload.portalAccessId,
    type: "refresh",
  } as PortalRefreshPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime("7d") // Refresh token expires in 7 days
    .sign(JWT_SECRET);

  return token;
}

/**
 * Verify and decode a portal access token
 */
export async function verifyPortalToken(token: string): Promise<PortalTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (payload.type !== "portal") {
      return null;
    }

    return payload as PortalTokenPayload;
  } catch (error) {
    log.error({ err: error }, "Token verification failed");
    return null;
  }
}

/**
 * Verify and decode a refresh token
 */
export async function verifyRefreshToken(token: string): Promise<PortalRefreshPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (payload.type !== "refresh") {
      return null;
    }

    return payload as PortalRefreshPayload;
  } catch (error) {
    log.error({ err: error }, "Refresh token verification failed");
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Check if token is about to expire (within 5 minutes)
 */
export function isTokenExpiringSoon(payload: JWTPayload): boolean {
  if (!payload.exp) return true;
  const expiresAt = payload.exp * 1000; // Convert to milliseconds
  const fiveMinutes = 5 * 60 * 1000;
  return Date.now() > expiresAt - fiveMinutes;
}
