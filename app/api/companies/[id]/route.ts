import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      pipelineRuns: {
        orderBy: { startedAt: "desc" },
        take: 1,
      },
      employees: {
        where: { isTop: true },
        orderBy: { relevanceScore: "desc" },
        include: {
          emailLookups: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          emailDrafts: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  return NextResponse.json(company);
}
