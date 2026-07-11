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
    // Supabase/PostgREST caps unbounded selects at its configured "Max Rows"
    // setting (1000 by default). Paginate in batches of 1000 so the full
    // table is always returned, no matter how large it grows.
    const pageSize = 1000;
    let from = 0;
    let all: Contact[] = [];

    while (true) {
      const { data, error } = await supabaseAdmin
        .from("contacts")
        .select("id, name, phone, created_at")
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      all = all.concat(data as Contact[]);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    return res.status(200).json({ contacts: all });
  } catch (err) {
    console.error("list.ts fetch failed:", err);
    return res.status(500).json({ error: "Failed to fetch contacts" });
  }
}
