import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { EmailStatus } from "@prisma/client";

const EmailUpdateSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address"),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: employeeId } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = EmailUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid email" },
        { status: 400 }
      );
    }

    const cleanedEmail = parsed.data.email.toLowerCase();

    // Check if employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        emailLookups: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    let lookupRecord;
    if (employee.emailLookups.length > 0) {
      // Update existing lookup
      lookupRecord = await prisma.emailLookup.update({
        where: { id: employee.emailLookups[0].id },
        data: {
          email: cleanedEmail,
          status: EmailStatus.FOUND,
          confidence: 100,
          source: "Manual user edit",
        },
      });
    } else {
      // Create new lookup
      lookupRecord = await prisma.emailLookup.create({
        data: {
          employeeId: employee.id,
          email: cleanedEmail,
          status: EmailStatus.FOUND,
          confidence: 100,
          source: "Manual user edit",
        },
      });
    }

    return NextResponse.json({
      success: true,
      email: cleanedEmail,
      lookup: lookupRecord,
    });
  } catch (err: any) {
    console.error("[Update Contact Email Error]", err);
    return NextResponse.json(
      { error: err.message || "Failed to update contact email" },
      { status: 500 }
    );
  }
}
