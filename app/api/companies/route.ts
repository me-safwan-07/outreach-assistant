import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      pipelineRuns: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { stage: true, progress: true, startedAt: true },
      },
      _count: { select: { employees: { where: { isTop: true } } } },
    },
  });

  return NextResponse.json(companies);
}
