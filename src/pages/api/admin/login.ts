import type { NextApiRequest, NextApiResponse } from "next";
import { createAdminToken } from "@/lib/adminAuth";
import type { AdminLoginResponse } from "@/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminLoginResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { username, password } = (req.body || {}) as { username?: string; password?: string };

  if (!username || typeof username !== "string") {
    return res.status(400).json({ success: false, error: "Username required" });
  }
  if (!password || typeof password !== "string") {
    return res.status(400).json({ success: false, error: "Password required" });
  }

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminUsername || !adminPassword) {
    return res.status(500).json({ success: false, error: "Admin credentials not configured" });
  }

  if (username !== adminUsername || password !== adminPassword) {
    return res.status(401).json({ success: false, error: "Incorrect username or password" });
  }

  const token = createAdminToken();
  return res.status(200).json({ success: true, token });
}
