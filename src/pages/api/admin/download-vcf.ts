import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getTokenFromRequest, verifyAdminToken } from "@/lib/adminAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!verifyAdminToken(getTokenFromRequest(req))) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { data, error } = await supabaseAdmin.from("contacts").select("name, phone");
    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "No contacts found" });
    }

    let vcfContent = "";
    for (const c of data as { name: string | null; phone: string }[]) {
      vcfContent += "BEGIN:VCARD\nVERSION:3.0\n";
      vcfContent += `FN:${c.name || ""}\n`;
      vcfContent += `TEL:${c.phone || ""}\n`;
      vcfContent += "END:VCARD\n\n";
    }

    res.setHeader("Content-Type", "text/vcard");
    res.setHeader("Content-Disposition", "attachment; filename=contacts.vcf");
    return res.status(200).send(vcfContent);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to generate VCF" });
  }
}
