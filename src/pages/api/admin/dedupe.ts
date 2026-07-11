import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getTokenFromRequest, verifyAdminToken } from "@/lib/adminAuth";

interface RawContact {
  id: string | number;
  phone: string;
  created_at: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean; removed: number } | { error: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!verifyAdminToken(getTokenFromRequest(req))) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .select("id, phone, created_at")
      .order("created_at", { ascending: true });

    if (error) throw error;

    const rows = (data || []) as RawContact[];

    // Group by normalized phone number, keep the earliest row (first seen since
    // sorted ascending by created_at), mark the rest for deletion.
    const seenPhones = new Set<string>();
    const idsToDelete: (string | number)[] = [];

    for (const row of rows) {
      const normalized = (row.phone || "").replace(/[^\d+]/g, "");
      if (seenPhones.has(normalized)) {
        idsToDelete.push(row.id);
      } else {
        seenPhones.add(normalized);
      }
    }

    if (idsToDelete.length === 0) {
      return res.status(200).json({ success: true, removed: 0 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("contacts")
      .delete()
      .in("id", idsToDelete);

    if (deleteError) throw deleteError;

    return res.status(200).json({ success: true, removed: idsToDelete.length });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
