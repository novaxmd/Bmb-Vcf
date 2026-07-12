import type { NextApiRequest, NextApiResponse } from "next";
import { hashPassword } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { token, username, password } = (req.body || {}) as {
    token?: string;
    username?: string;
    password?: string;
  };

  if (!token || typeof token !== "string") {
    return res.status(400).json({ success: false, error: "Missing invite token." });
  }
  const trimmedUsername = (username || "").trim();
  if (!trimmedUsername || trimmedUsername.length < 3) {
    return res.status(400).json({ success: false, error: "Username must be at least 3 characters." });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ success: false, error: "Password must be at least 8 characters." });
  }

  try {
    const { data: invite, error: lookupError } = await supabaseAdmin
      .from("admins")
      .select("id, invite_expires_at, status")
      .eq("invite_token", token)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!invite) {
      return res.status(404).json({ success: false, error: "This invite link is invalid." });
    }
    if (invite.status === "active") {
      return res.status(400).json({ success: false, error: "This invite has already been used." });
    }
    if (!invite.invite_expires_at || new Date(invite.invite_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ success: false, error: "This invite link has expired. Ask the owner to resend it." });
    }

    // Ensure username isn't already taken by another admin
    const { data: usernameTaken, error: usernameError } = await supabaseAdmin
      .from("admins")
      .select("id")
      .eq("username", trimmedUsername)
      .neq("id", invite.id)
      .maybeSingle();
    if (usernameError) throw usernameError;
    if (usernameTaken) {
      return res.status(400).json({ success: false, error: "That username is already taken." });
    }

    const passwordHash = hashPassword(password);
    const { error: updateError } = await supabaseAdmin
      .from("admins")
      .update({
        username: trimmedUsername,
        password_hash: passwordHash,
        status: "active",
        invite_token: null,
        invite_expires_at: null,
      })
      .eq("id", invite.id);

    if (updateError) throw updateError;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("accept-invite.ts failed:", err);
    return res.status(500).json({ success: false, error: "Failed to set up your account. Please try again." });
  }
}
