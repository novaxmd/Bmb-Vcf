import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getTokenFromRequest, verifyAdminToken } from "@/lib/adminAuth";
import type { Contact } from "@/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Contact[] | { error: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!verifyAdminToken(getTokenFromRequest(req))) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { query } = (req.body || {}) as { query?: string };
  if (!query || query.trim() === "") {
    return res.status(400).json({ error: "Search query required" });
  }

  const searchTerm = `%${query.trim()}%`;

  try {
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .select("id, name, phone, created_at")
      .or(`name.ilike.${searchTerm},phone.ilike.${searchTerm}`)
      .limit(50);

    if (error) throw error;
    return res.status(200).json(data || []);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to search contacts" });
  }
}
