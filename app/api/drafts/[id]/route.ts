import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DraftStatus, EmailStatus } from "@prisma/client";

const UpdateSchema = z.object({
  subject: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(5000).optional(),
  status: z.nativeEnum(DraftStatus).optional(),
  recipientEmail: z.string().email().optional().or(z.literal("")),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const draft = await prisma.emailDraft.findUnique({
    where: { id },
    include: {
      employee: {
        include: {
          emailLookups: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  return NextResponse.json(draft);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { recipientEmail, ...draftData } = parsed.data;

  const draft = await prisma.emailDraft.update({
    where: { id },
    data: draftData,
    include: {
      employee: {
        include: {
          emailLookups: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  // If user updated the recipient email, sync it to the employee's EmailLookup
  if (recipientEmail && recipientEmail.trim()) {
    const cleaned = recipientEmail.trim().toLowerCase();
    const existingLookup = draft.employee.emailLookups[0];

    if (existingLookup) {
      await prisma.emailLookup.update({
        where: { id: existingLookup.id },
        data: {
          email: cleaned,
          status: EmailStatus.FOUND,
          confidence: 100,
          source: "Manual user edit",
        },
      });
    } else {
      await prisma.emailLookup.create({
        data: {
          employeeId: draft.employeeId,
          email: cleaned,
          status: EmailStatus.FOUND,
          confidence: 100,
          source: "Manual user edit",
        },
      });
    }
  }

  return NextResponse.json(draft);
}
