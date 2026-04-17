import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET — Export leads as CSV
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leads = await prisma.lead.findMany({
    where: {
      igAccount: { userId: session.user.id },
    },
    include: {
      trigger: { select: { type: true, keywords: true } },
    },
    orderBy: { capturedAt: "desc" },
  });

  // Build CSV
  const headers = ["#", "Username", "Trigger Type", "Keywords", "Captured At"];
  const rows = leads.map((lead, i) => [
    i + 1,
    `@${lead.igUsername}`,
    lead.trigger?.type || "N/A",
    lead.trigger?.keywords?.join(", ") || "N/A",
    new Date(lead.capturedAt).toISOString(),
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="zepply-leads-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
