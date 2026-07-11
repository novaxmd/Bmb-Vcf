import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseServer";
import type { CountResponse } from "@/types";

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
    return res.status(200).json({ count: count ?? 0 });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch count" });
  }
}
