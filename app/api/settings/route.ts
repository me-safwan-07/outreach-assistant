import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { MY_PROFILE } from "@/config/profile";

const SettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.string().min(1).max(100).optional(),
  location: z.string().max(100).optional(),
  education: z.string().max(300).optional(),
  experience: z.string().max(1000).optional(),
  techStack: z.string().max(500).optional(),
  portfolioUrl: z.string().url().optional(),
  maxApifyCalls: z.number().int().min(0).max(10000).optional(),
  maxHunterCalls: z.number().int().min(0).max(1000).optional(),
  maxGeminiCalls: z.number().int().min(0).max(10000).optional(),
});

export async function GET() {
  const dbSettings = await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      name: MY_PROFILE.name,
      role: MY_PROFILE.role,
      location: MY_PROFILE.location,
      education: MY_PROFILE.education,
      experience: MY_PROFILE.experience,
      techStack: MY_PROFILE.techStack.join(", "),
      portfolioUrl: MY_PROFILE.portfolioUrl,
    },
  });

  // Also fetch API usage for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const usage = await prisma.apiUsage.findMany({
    where: { date: { gte: today } },
  });

  return NextResponse.json({ settings: dbSettings, usage });
}

export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Save profile and limits to DB
  const dbSettings = await prisma.settings.upsert({
    where: { id: "singleton" },
    update: parsed.data,
    create: { id: "singleton", ...parsed.data },
  });

  return NextResponse.json(dbSettings);
}
