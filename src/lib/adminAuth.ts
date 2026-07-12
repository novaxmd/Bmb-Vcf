import crypto from "crypto";
import type { NextApiRequest } from "next";

// Session tokens are short-lived signed strings:
// "<expiryTimestamp>.<adminId>.<role>.<signature>"
// Signed with HMAC-SHA256 using a server secret so they can't be forged.
// adminId is "owner" for the single env-based Owner account, or the numeric
// id of a row in the `admins` table for invited admins.

const TOKEN_TTL_MS = 1000 * 60 * 60 * 4; // 4 hours

export type AdminRole = "owner" | "admin";

function getSecret(): string {
  const adminPassword = process.env.ADMIN_PASSWORD || "";
  const extraSecret = process.env.SESSION_SECRET || "";
  return `${adminPassword}:${extraSecret}`;
}

export function createAdminToken(adminId: string, role: AdminRole): string {
  const expires = Date.now() + TOKEN_TTL_MS;
  const payload = `${expires}.${adminId}.${role}`;
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}

export type VerifiedAdmin = { adminId: string; role: AdminRole };

export function verifyAdminToken(token: string | undefined | null): VerifiedAdmin | null {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;

  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [expiresStr, adminId, role, signature] = parts;
  const payload = `${expiresStr}.${adminId}.${role}`;

  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

  const expires = parseInt(expiresStr, 10);
  if (Number.isNaN(expires) || Date.now() > expires) return null;
  if (role !== "owner" && role !== "admin") return null;

  return { adminId, role: role as AdminRole };
}

// Backwards-compatible boolean check used by older call sites.
export function isValidAdminToken(token: string | undefined | null): boolean {
  return verifyAdminToken(token) !== null;
}

// Extracts the admin token from the Authorization header ("Bearer <token>")
export function getTokenFromRequest(req: NextApiRequest): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

// --- Password hashing (for invited admins' own username/password) ---
// scrypt-based, salted. Stored as "salt:hash" in admins.password_hash.

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  const hashBuffer = Buffer.from(hash, "hex");
  const candidateBuffer = Buffer.from(candidate, "hex");
  if (hashBuffer.length !== candidateBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, candidateBuffer);
}

// --- Invite tokens (separate from session tokens, single-use, emailed) ---

export function createInviteToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
