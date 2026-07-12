import type { NextApiRequest, NextApiResponse } from "next";
import { getTokenFromRequest, verifyAdminToken, createInviteToken } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { sendInviteEmail } from "@/lib/resend";

const INVITE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const verified = verifyAdminToken(getTokenFromRequest(req));
  if (!verified) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (verified.role !== "owner") {
    return res.status(403).json({ success: false, error: "Only the owner can invite admins." });
  }

  const { email } = (req.body || {}) as { email?: string };
  const trimmedEmail = (email || "").trim().toLowerCase();
  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return res.status(400).json({ success: false, error: "Enter a valid email address." });
  }

  try {
    // Prevent duplicate active/pending invites for the same email
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("admins")
      .select("id, status")
      .eq("email", trimmedEmail)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (existing && existing.status === "active") {
      return res.status(400).json({ success: false, error: "This email is already an active admin." });
    }

    const inviteToken = createInviteToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

    if (existing) {
      // Re-invite: refresh the token instead of creating a duplicate row
      const { error: updateError } = await supabaseAdmin
        .from("admins")
        .update({ invite_token: inviteToken, invite_expires_at: expiresAt, status: "pending" })
        .eq("id", existing.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabaseAdmin.from("admins").insert({
        email: trimmedEmail,
        invite_token: inviteToken,
        invite_expires_at: expiresAt,
        status: "pending",
      });
      if (insertError) throw insertError;
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.host}`;
    const inviteUrl = `${baseUrl}/accept-invite?token=${inviteToken}`;

    await sendInviteEmail(trimmedEmail, inviteUrl);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("invite.ts failed:", err);
    const message = err instanceof Error ? err.message : "Failed to send invite.";
    return res.status(500).json({ success: false, error: message });
  }
}
