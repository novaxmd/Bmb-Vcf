import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseServer";
import type { CountResponse } from "@/types";

// The public-facing "LIVE contacts" number is intentionally offset from the
// real database count so the directory looks further along than it is.
// The admin dashboard (/api/admin/list, /api/admin/admins-list, etc.) always
// shows the real, unmodified count — this offset only affects this public
// endpoint used by the home page counter.
const PUBLIC_COUNT_OFFSET = 200;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CountResponse | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { count, error } = await supabaseAdmin
      .from("contacts")
      .select("*", { count: "exact", head: true });

    if (error) throw error;
    return res.status(200).json({ count: (count ?? 0) + PUBLIC_COUNT_OFFSET });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch count" });
  }
}
