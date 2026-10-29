import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline/runner";
import { PipelineStage } from "@prisma/client";

const StartSchema = z.object({
  linkedinUrl: z
    .string()
    .url()
    .refine(
      (url) => /linkedin\.com\/company\//i.test(url),
      "Must be a LinkedIn company URL (linkedin.com/company/...)"
    ),
  refresh: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = StartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { linkedinUrl, refresh } = parsed.data;

  // Normalise URL: strip trailing slash and query params
  const cleanUrl = linkedinUrl.replace(/\/+$/, "").split("?")[0];

  // Check if company already processed (skip if not refresh)
  const existing = await prisma.company.findUnique({
    where: { linkedinUrl: cleanUrl },
    include: {
      pipelineRuns: {
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
  });

  if (existing && !refresh) {
    const lastRun = existing.pipelineRuns[0];
    const employeeCount = await prisma.employee.count({
      where: { companyId: existing.id },
    });

    if (lastRun?.stage === PipelineStage.DONE && employeeCount > 0 && existing.name) {
      return NextResponse.json({
        companyId: existing.id,
        pipelineRunId: lastRun.id,
        stage: lastRun.stage,
        alreadyDone: true,
      });
    }
    // Resume failed run
    if (lastRun?.stage === PipelineStage.FAILED) {
      // Fire pipeline without awaiting
      setImmediate(() =>
        runPipeline(cleanUrl, lastRun.id).catch(console.error)
      );
      return NextResponse.json({
        companyId: existing.id,
        pipelineRunId: lastRun.id,
        stage: PipelineStage.COMPANY,
        resumed: true,
      });
    }
    // Already in progress
    if (lastRun) {
      return NextResponse.json({
        companyId: existing.id,
        pipelineRunId: lastRun.id,
        stage: lastRun.stage,
        inProgress: true,
      });
    }
  }

  // Get or create the company stub
  const company = await prisma.company.upsert({
    where: { linkedinUrl: cleanUrl },
    update: {},
    create: { linkedinUrl: cleanUrl },
  });

  // Create a new pipeline run
  const run = await prisma.pipelineRun.create({
    data: {
      companyId: company.id,
      stage: PipelineStage.COMPANY,
      progress: 0,
    },
  });

  // Fire pipeline asynchronously
  setImmediate(() => runPipeline(cleanUrl, run.id).catch(console.error));

  return NextResponse.json({
    companyId: company.id,
    pipelineRunId: run.id,
    stage: PipelineStage.COMPANY,
    started: true,
  });
}
