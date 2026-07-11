import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseServer";
import type { UploadResponse } from "@/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { name, phone } = (req.body || {}) as { name?: string; phone?: string };
    if (!phone) return res.status(400).json({ error: "phone required" });

    const normalized = ("" + phone).replace(/[^\d+]/g, "");

    const { data: existing, error: checkError } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("phone", normalized);

    if (checkError) throw checkError;
    if (existing && existing.length > 0) {
      return res.status(200).json({ exists: true });
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("contacts")
      .insert({ name: name || null, phone: normalized })
      .select();

    if (insertError) throw insertError;

    return res.status(200).json({ success: true, inserted: inserted?.[0] });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
