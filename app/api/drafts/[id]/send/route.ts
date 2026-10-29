import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendDirectEmail, getResumeAttachment } from "@/lib/email/sender";
import { MY_PROFILE } from "@/config/profile";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const draft = await prisma.emailDraft.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            emailLookups: true,
          },
        },
      },
    });

    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    const recipientLookup = draft.employee.emailLookups[0];
    const recipientEmail = recipientLookup?.email;

    if (!recipientEmail || recipientLookup?.status === "NOT_FOUND") {
      return NextResponse.json(
        {
          error:
            "No valid email address found for this contact. Use LinkedIn connection note instead.",
        },
        { status: 400 }
      );
    }

    const attachmentInfo = getResumeAttachment();

    // Attempt direct email dispatch
    const result = await sendDirectEmail({
      to: recipientEmail,
      subject: draft.subject,
      body: draft.body,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          smtpConfigured: result.smtpConfigured,
          error: result.error,
          resumeAttached: !!attachmentInfo,
          resumePath: attachmentInfo?.path,
          resumeUrl: MY_PROFILE.resumeDriveUrl,
        },
        { status: result.smtpConfigured ? 500 : 400 }
      );
    }

    // Mark as SENT in database
    await prisma.emailDraft.update({
      where: { id },
      data: { status: "SENT" },
    });

    return NextResponse.json({
      success: true,
      message: `Email successfully sent to ${recipientEmail} with resume attached!`,
      messageId: result.messageId,
      attachedFile: result.attachedFile,
    });
  } catch (err: any) {
    console.error("[Send Draft Error]", err);
    return NextResponse.json(
      { error: err.message || "Failed to process email dispatch" },
      { status: 500 }
    );
  }
}
