import crypto from "crypto";
import type { NextApiRequest } from "next";

// Session tokens are short-lived signed strings: "<expiryTimestamp>.<signature>"
// Signed with HMAC-SHA256 using ADMIN_PASSWORD + a server secret so they can't
// be forged without knowing the environment variables.

const TOKEN_TTL_MS = 1000 * 60 * 60 * 4; // 4 hours

function getSecret(): string {
  const adminPassword = process.env.ADMIN_PASSWORD || "";
  const extraSecret = process.env.SESSION_SECRET || "";
  return `${adminPassword}:${extraSecret}`;
}

export function createAdminToken(): string {
  const expires = Date.now() + TOKEN_TTL_MS;
  const payload = `${expires}`;
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}

export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length) return false;
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return false;

  const expires = parseInt(payload, 10);
  if (Number.isNaN(expires) || Date.now() > expires) return false;

  return true;
}

// Extracts the admin token from the Authorization header ("Bearer <token>")
export function getTokenFromRequest(req: NextApiRequest): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}
