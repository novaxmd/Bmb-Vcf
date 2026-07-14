import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { phone } = (req.body || {}) as { phone?: string };
  if (!phone || typeof phone !== "string") {
    return res.status(400).json({ error: "Phone number required" });
  }

  const normalized = phone.replace(/[^\d+]/g, "");
  if (normalized.replace(/\D/g, "").length < 5) {
    return res.status(400).json({ error: "Enter a valid phone number" });
  }

  try {
    // Only ever return whether it exists — never any other field (name, id,
    // etc.) — this endpoint is public and unauthenticated.
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("phone", normalized)
      .maybeSingle();

    if (error) throw error;
    return res.status(200).json({ exists: !!data });
  } catch (err) {
    console.error("check-number.ts failed:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
