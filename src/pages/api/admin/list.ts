import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getTokenFromRequest, verifyAdminToken } from "@/lib/adminAuth";
import type { Contact } from "@/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ contacts: Contact[] } | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!verifyAdminToken(getTokenFromRequest(req))) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .select("id, name, phone, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return res.status(200).json({ contacts: data || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch contacts" });
  }
}
