import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { query } = (req.body || {}) as { query?: string };
  const trimmed = (query || "").trim();
  if (!trimmed) {
    return res.status(400).json({ error: "Enter a name or phone number." });
  }
  if (trimmed.length < 2) {
    return res.status(400).json({ error: "Enter at least 2 characters." });
  }

  // Decide whether this looks like a phone number (mostly digits/+) or a name.
  const digitsOnly = trimmed.replace(/\D/g, "");
  const looksLikePhone = digitsOnly.length >= 5 && digitsOnly.length / trimmed.length > 0.5;

  try {
    // Only ever return whether a match exists — never any other field (name,
    // phone, id, etc.) — this endpoint is public and unauthenticated, and
    // must not leak other people's registered details.
    let found = false;

    if (looksLikePhone) {
      const normalizedPhone = trimmed.replace(/[^\d+]/g, "");
      const { data, error } = await supabaseAdmin
        .from("contacts")
        .select("id")
        .eq("phone", normalizedPhone)
        .maybeSingle();
      if (error) throw error;
      found = !!data;
    } else {
      const { data, error } = await supabaseAdmin
        .from("contacts")
        .select("id")
        .ilike("name", trimmed)
        .limit(1);
      if (error) throw error;
      found = !!data && data.length > 0;
    }

    return res.status(200).json({ exists: found });
  } catch (err) {
    console.error("check-number.ts failed:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
