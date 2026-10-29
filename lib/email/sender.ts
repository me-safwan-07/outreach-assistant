import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { MY_PROFILE } from "@/config/profile";
import { getSmtpConfig } from "./smtpConfig";

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  customAttachmentPath?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  attachedFile?: string;
  smtpConfigured: boolean;
}

export function getResumeAttachment() {
  const possiblePaths = [
    MY_PROFILE.resumeLocalPath,
    path.join(process.cwd(), "public", "SAFWAN-RESUME.pdf"),
    path.join(process.cwd(), "public", "resume.pdf"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return {
        path: p,
        filename: "Muhammed_Safwan_Resume.pdf",
        contentType: "application/pdf",
      };
    }
  }

  return null;
}

export async function sendDirectEmail(
  options: SendEmailOptions
): Promise<SendEmailResult> {
  const { to, subject, body, customAttachmentPath } = options;

  const smtpConfig = getSmtpConfig();
  const smtpFrom = smtpConfig.smtpEmail;
  const smtpUsername = smtpConfig.smtpUsername;
  const smtpPass = smtpConfig.smtpPassword;
  const smtpHost = smtpConfig.smtpHost;
  const smtpPort = smtpConfig.smtpPort;

  if (!smtpFrom || !smtpUsername || !smtpPass || !smtpHost || !smtpPort) {
    return {
      success: false,
      smtpConfigured: false,
      error:
        "SMTP is not fully configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in .env. SMTP_FROM_EMAIL is optional and defaults to SMTP_USER.",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUsername,
        pass: smtpPass,
      },
    });

    // Verify attachment
    let attachment = null;
    if (customAttachmentPath && fs.existsSync(customAttachmentPath)) {
      attachment = {
        path: customAttachmentPath,
        filename: "Muhammed_Safwan_Resume.pdf",
        contentType: "application/pdf",
      };
    } else {
      attachment = getResumeAttachment();
    }

    const attachments = attachment ? [attachment] : [];

    const mailOptions = {
      from: `"${MY_PROFILE.name}" <${smtpFrom}>`,
      to,
      subject,
      text: body,
      attachments,
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId,
      attachedFile: attachment ? attachment.filename : undefined,
      smtpConfigured: true,
    };
  } catch (err: unknown) {
    console.error("[EmailSender Error]", err);
    return {
      success: false,
      smtpConfigured: true,
      error: err instanceof Error ? err.message : "Failed to send email via SMTP",
    };
  }
}
