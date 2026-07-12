import type { NextApiRequest, NextApiResponse } from "next";
import { hashPassword } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { token, password } = (req.body || {}) as { token?: string; password?: string };

  if (!token || typeof token !== "string") {
    return res.status(400).json({ success: false, error: "Missing reset token." });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ success: false, error: "Password must be at least 8 characters." });
  }

  try {
    const { data: admin, error: lookupError } = await supabaseAdmin
      .from("admins")
      .select("id, reset_expires_at, status")
      .eq("reset_token", token)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!admin || admin.status !== "active") {
      return res.status(404).json({ success: false, error: "This reset link is invalid." });
    }
    if (!admin.reset_expires_at || new Date(admin.reset_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ success: false, error: "This reset link has expired. Request a new one." });
    }

    const passwordHash = hashPassword(password);
    const { error: updateError } = await supabaseAdmin
      .from("admins")
      .update({
        password_hash: passwordHash,
        reset_token: null,
        reset_expires_at: null,
      })
      .eq("id", admin.id);

    if (updateError) throw updateError;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("reset-password.ts failed:", err);
    return res.status(500).json({ success: false, error: "Failed to reset password. Please try again." });
  }
}
