import type { NextApiRequest, NextApiResponse } from "next";
import { createInviteToken } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { sendResetPasswordEmail } from "@/lib/resend";

const RESET_TTL_MS = 1000 * 60 * 60; // 1 hour

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { email } = (req.body || {}) as { email?: string };
  const trimmedEmail = (email || "").trim().toLowerCase();
  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return res.status(400).json({ success: false, error: "Enter a valid email address." });
  }

  // Always respond with the same generic success message, whether or not the
  // email matches an admin — this avoids leaking which emails are registered.
  const genericResponse = {
    success: true,
    message: "If that email is registered as an admin, a reset link has been sent.",
  };

  try {
    const { data, error } = await supabaseAdmin
      .from("admins")
      .select("id, status")
      .eq("email", trimmedEmail)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw error;

    if (data) {
      const resetToken = createInviteToken();
      const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();

      const { error: updateError } = await supabaseAdmin
        .from("admins")
        .update({ reset_token: resetToken, reset_expires_at: expiresAt })
        .eq("id", data.id);
      if (updateError) throw updateError;

      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.host}`;
      const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

      await sendResetPasswordEmail(trimmedEmail, resetUrl);
    }

    return res.status(200).json(genericResponse);
  } catch (err) {
    console.error("forgot-password.ts failed:", err);
    // Still return the generic message so we don't leak account existence
    // via error responses either.
    return res.status(200).json(genericResponse);
  }
}
