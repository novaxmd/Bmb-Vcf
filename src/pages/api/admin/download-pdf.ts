import type { NextApiRequest, NextApiResponse } from "next";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
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
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .select("name, phone")
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: "No contacts found" });
    }

    const contacts = data as { name: string | null; phone: string }[];

    // jsPDF has no external font-file dependency at runtime, unlike pdfkit,
    // which makes it reliable inside Vercel's serverless environment.
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("BMB VCF - Contacts List", 297.5, 50, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()}`, 545, 70, { align: "right" });
    doc.text(`Total contacts: ${contacts.length}`, 50, 70);

    autoTable(doc, {
      startY: 90,
      head: [["#", "Name", "Phone Number"]],
      body: contacts.map((c, i) => [String(i + 1), c.name || "No name", c.phone || "No phone"]),
      headStyles: { fillColor: [20, 40, 20], textColor: [255, 255, 255] },
      styles: { fontSize: 10, cellPadding: 6 },
      alternateRowStyles: { fillColor: [245, 250, 245] },
      didDrawPage: () => {
        const pageCount = doc.getNumberOfPages();
        const pageCurrent = doc.getCurrentPageInfo().pageNumber;
        doc.setFontSize(8);
        doc.text(
          `Page ${pageCurrent} of ${pageCount}`,
          297.5,
          doc.internal.pageSize.getHeight() - 20,
          { align: "center" }
        );
      },
    });

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=contacts.pdf");
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
    else res.end();
  }
}
