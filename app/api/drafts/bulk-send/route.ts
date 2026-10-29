import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendDirectEmail } from "@/lib/email/sender";
import { EmailStatus } from "@prisma/client";

export type BulkSendMode = "ALL" | "VERIFIED" | "HIGH_SCORE" | "WITH_DRAFTS";

interface BulkSendRequest {
  companyId: string;
  mode: BulkSendMode;
  delayMs?: number;      // delay between BATCHES (default 800 ms)
  concurrency?: number;  // parallel sends per batch (default 3, max 10)
}

interface BulkSendResultItem {
  employeeId: string;
  draftId: string;
  name: string;
  email: string;
  success: boolean;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

// ── Chunk an array into groups of `size` ────────────────────────
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BulkSendRequest;
    const {
      companyId,
      mode = "VERIFIED",
      delayMs = 800,
      concurrency = 3,
    } = body;

    const safeConcurrency = Math.min(Math.max(1, concurrency), 10);

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    // ── Build smart DB where-clause so we only load relevant rows ──
    const emailLookupFilter =
      mode === "VERIFIED"
        ? { some: { status: EmailStatus.FOUND, email: { not: null } } }
        : mode === "ALL" || mode === "HIGH_SCORE" || mode === "WITH_DRAFTS"
        ? { some: { email: { not: null } } }
        : undefined;

    const scoreFilter = mode === "HIGH_SCORE" ? { gte: 75 } : undefined;

    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        ...(scoreFilter ? { relevanceScore: scoreFilter } : {}),
        emailDrafts: { some: { status: { not: "SENT" } } },
        ...(emailLookupFilter ? { emailLookups: emailLookupFilter } : {}),
      },
      include: {
        emailLookups: { orderBy: { createdAt: "desc" } },
        emailDrafts: {
          where: { status: { not: "SENT" } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { relevanceScore: "desc" },
    });

    const results: BulkSendResultItem[] = [];
    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let smtpAborted = false;

    // ── Filter candidates ─────────────────────────────────────────
    type Candidate = {
      emp: (typeof employees)[number];
      draft: (typeof employees)[number]["emailDrafts"][number];
      email: string;
    };

    const candidates: Candidate[] = [];

    for (const emp of employees) {
      const name = `${emp.firstName} ${emp.lastName}`;
      const draft = emp.emailDrafts[0];

      if (!draft) {
        results.push({ employeeId: emp.id, draftId: "", name, email: "", success: false, skipped: true, skipReason: "No email draft available" });
        skippedCount++;
        continue;
      }

      const verifiedLookup = emp.emailLookups.find((l) => l.status === "FOUND" && l.email);
      const anyLookup = emp.emailLookups.find((l) => l.email);

      if (mode === "VERIFIED" && !verifiedLookup) {
        results.push({ employeeId: emp.id, draftId: draft.id, name, email: "", success: false, skipped: true, skipReason: "No verified email — skipped (Verified Only mode)" });
        skippedCount++;
        continue;
      }

      const lookup = mode === "VERIFIED" ? verifiedLookup : anyLookup;

      if (!lookup?.email) {
        results.push({ employeeId: emp.id, draftId: draft.id, name, email: "", success: false, skipped: true, skipReason: "No email address found" });
        skippedCount++;
        continue;
      }

      candidates.push({ emp, draft, email: lookup.email });
    }

    // ── Send in parallel batches ───────────────────────────────────
    const sentDraftIds: string[] = [];
    const batches = chunk(candidates, safeConcurrency);

    for (let bi = 0; bi < batches.length; bi++) {
      if (smtpAborted) break;

      const batch = batches[bi];

      const batchResults = await Promise.allSettled(
        batch.map(async ({ emp, draft, email }) => {
          const name = `${emp.firstName} ${emp.lastName}`;
          const sendResult = await sendDirectEmail({
            to: email,
            subject: draft.subject,
            body: draft.body,
          });
          return { emp, draft, email, name, sendResult };
        })
      );

      for (const settled of batchResults) {
        if (settled.status === "rejected") {
          failedCount++;
          results.push({
            employeeId: "",
            draftId: "",
            name: "Unknown",
            email: "",
            success: false,
            error: String(settled.reason),
          });
          continue;
        }

        const { emp, draft, email, name, sendResult } = settled.value;

        if (sendResult.success) {
          sentDraftIds.push(draft.id);
          results.push({ employeeId: emp.id, draftId: draft.id, name, email, success: true });
          sentCount++;
        } else {
          if (!sendResult.smtpConfigured) {
            smtpAborted = true;
            results.push({ employeeId: emp.id, draftId: draft.id, name, email, success: false, error: sendResult.error });
            failedCount++;
            break;
          }
          results.push({ employeeId: emp.id, draftId: draft.id, name, email, success: false, error: sendResult.error });
          failedCount++;
        }
      }

      // ── Batch-update sent drafts after each batch ────────────────
      if (sentDraftIds.length > 0) {
        await prisma.emailDraft.updateMany({
          where: { id: { in: sentDraftIds.splice(0) } },
          data: { status: "SENT" },
        });
      }

      // ── Inter-batch delay (skip on last batch) ───────────────────
      if (delayMs > 0 && bi < batches.length - 1 && !smtpAborted) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    // Flush any remaining unsaved sent IDs
    if (sentDraftIds.length > 0) {
      await prisma.emailDraft.updateMany({
        where: { id: { in: sentDraftIds } },
        data: { status: "SENT" },
      });
    }

    if (smtpAborted) {
      return NextResponse.json(
        {
          success: false,
          smtpConfigured: false,
          error: "SMTP not configured. Please add your Gmail App Password in Settings.",
          results,
          summary: { sent: sentCount, skipped: skippedCount, failed: failedCount, total: employees.length },
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      summary: { sent: sentCount, skipped: skippedCount, failed: failedCount, total: employees.length },
      results,
    });
  } catch (err: unknown) {
    console.error("[BulkSend Error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bulk send failed" },
      { status: 500 }
    );
  }
}
