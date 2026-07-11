import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getTokenFromRequest, verifyAdminToken } from "@/lib/adminAuth";
import type { Contact } from "@/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean; updated?: Contact } | { error: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!verifyAdminToken(getTokenFromRequest(req))) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id, name, phone } = (req.body || {}) as { id?: string; name?: string; phone?: string };
  if (!id) return res.status(400).json({ error: "Contact ID required" });

  const updateData: Partial<Contact> = {};
  if (name !== undefined) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone;

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .update(updateData)
      .eq("id", id)
      .select();

    if (error) throw error;
    return res.status(200).json({ success: true, updated: data?.[0] });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
