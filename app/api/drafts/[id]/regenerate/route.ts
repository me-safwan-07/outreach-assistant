import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline/runner";
import { env } from "@/lib/env";
import { PipelineStage, DraftStatus } from "@prisma/client";
import { generateEmail } from "@/lib/ai/generateEmail";
import { MY_PROFILE } from "@/config/profile";

// POST /api/drafts/[id]/regenerate — regenerate a single draft
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const draft = await prisma.emailDraft.findUnique({
    where: { id },
    include: {
      employee: true,
    },
  });

  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  const emp = draft.employee;

  // Load settings
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });

  if (env.MOCK_MODE) {
    const body = `Hi ${emp.firstName},\n\nI came across your LinkedIn profile and was particularly interested in your work as ${emp.currentTitle ?? "a professional"} at this company. I'm a Full Stack Developer (Next.js, React, TypeScript, Node.js, PostgreSQL) based in Bengaluru.\n\nI'd love to connect and learn more about any Full Stack or software engineering opportunities. My resume is attached.\n\nPortfolio: ${settings?.portfolioUrl ?? "https://www.muhammadsafwan.com/"}\n\nBest regards,\n${settings?.name ?? "Muhammed Safwan"}\nFull Stack Developer\nBengaluru, India`;

    const updated = await prisma.emailDraft.update({
      where: { id },
      data: {
        body,
        subject: `Full Stack Developer — ${emp.firstName} (regenerated)`,
        model: "mock",
        status: DraftStatus.DRAFT,
      },
    });
    return NextResponse.json(updated);
  }

  // Real generation
  try {
    const result = await generateEmail({
      firstName: emp.firstName,
      lastName: emp.lastName,
      headline: emp.headline ?? null,
      currentTitle: emp.currentTitle ?? null,
      about: emp.about ?? null,
      skills: (emp.skillsJson as string[]) ?? [],
      recentExperience: ((emp.experienceJson as Array<{ position?: string; companyName?: string }>) ?? []).slice(0, 2),
      hiring: emp.hiring ?? null,
      roleCategory: emp.roleCategory,
      senderName: settings?.name ?? "Muhammed Safwan",
      senderRole: settings?.role ?? "Full Stack Developer",
      senderLocation: settings?.location ?? MY_PROFILE.location,
      senderStack: settings?.techStack ?? MY_PROFILE.techStack.join(", "),
      senderPortfolio: settings?.portfolioUrl ?? MY_PROFILE.portfolioUrl,
      senderExperience: settings?.experience ?? MY_PROFILE.experience,
      senderEducation: settings?.education ?? MY_PROFILE.education,
    });

    await prisma.apiUsage.upsert({
      where: { provider_date: { provider: "gemini", date: new Date(new Date().setHours(0,0,0,0)) } },
      update: { count: { increment: 1 } },
      create: { provider: "gemini", count: 1, date: new Date(new Date().setHours(0,0,0,0)) },
    });

    const updated = await prisma.emailDraft.update({
      where: { id },
      data: {
        subject: result.subject,
        body: result.body,
        model: env.GEMINI_MODEL,
        status: DraftStatus.DRAFT,
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Generation failed: ${message}` }, { status: 500 });
  }
}
