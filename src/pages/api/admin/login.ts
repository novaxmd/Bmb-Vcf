import type { NextApiRequest, NextApiResponse } from "next";
import { createAdminToken, verifyPassword } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";
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

  // 1. Check the single Owner account (env-based, unchanged from before)
  const ownerUsername = process.env.ADMIN_USERNAME;
  const ownerPassword = process.env.ADMIN_PASSWORD;
  if (ownerUsername && ownerPassword && username === ownerUsername && password === ownerPassword) {
    const token = createAdminToken("owner", "owner");
    return res.status(200).json({ success: true, token });
  }

  // 2. Check invited admins in the database
  try {
    const { data, error } = await supabaseAdmin
      .from("admins")
      .select("id, username, password_hash, status")
      .eq("username", username)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw error;
    if (!data || !data.password_hash) {
      return res.status(401).json({ success: false, error: "Incorrect username or password" });
    }

    const valid = verifyPassword(password, data.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: "Incorrect username or password" });
    }

    const token = createAdminToken(String(data.id), "admin");
    return res.status(200).json({ success: true, token });
  } catch (err) {
    console.error("login.ts admin lookup failed:", err);
    return res.status(401).json({ success: false, error: "Incorrect username or password" });
  }
}
