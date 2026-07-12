import type { NextApiRequest, NextApiResponse } from "next";
import { getTokenFromRequest, verifyAdminToken } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const verified = verifyAdminToken(getTokenFromRequest(req));
  if (!verified) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (verified.role !== "owner") {
    return res.status(403).json({ error: "Only the owner can view admins." });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("admins")
      .select("id, email, username, status, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return res.status(200).json({ admins: data || [] });
  } catch (err) {
    console.error("admins-list.ts failed:", err);
    return res.status(500).json({ error: "Failed to load admins." });
  }
}
