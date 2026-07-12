import type { NextApiRequest, NextApiResponse } from "next";
import { getTokenFromRequest, verifyAdminToken } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Any logged-in admin (owner or invited admin) can view the team list —
  // only /api/admin/remove-admin.ts is restricted to the owner.
  const verified = verifyAdminToken(getTokenFromRequest(req));
  if (!verified) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("admins")
      .select("id, email, username, status, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      owner: { username: process.env.ADMIN_USERNAME || "owner" },
      admins: data || [],
    });
  } catch (err) {
    console.error("team-list.ts failed:", err);
    return res.status(500).json({ error: "Failed to load team." });
  }
}
