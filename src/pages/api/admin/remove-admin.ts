import type { NextApiRequest, NextApiResponse } from "next";
import { getTokenFromRequest, verifyAdminToken } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";

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
    return res.status(403).json({ success: false, error: "Only the owner can remove admins." });
  }

  const { id } = (req.body || {}) as { id?: string | number };
  if (id === undefined || id === null) {
    return res.status(400).json({ success: false, error: "Missing admin id." });
  }

  try {
    const { error } = await supabaseAdmin.from("admins").delete().eq("id", id);
    if (error) throw error;
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("remove-admin.ts failed:", err);
    return res.status(500).json({ success: false, error: "Failed to remove admin." });
  }
}
