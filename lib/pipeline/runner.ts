import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  PipelineStage,
  RoleCategory,
  EmailStatus,
  DraftStatus,
} from "@prisma/client";
import { scoreAndSelectEmployees } from "@/lib/scoring";
import { getEmailFinder } from "@/lib/email";
import { generateEmail } from "@/lib/ai/generateEmail";
import type { RawEmployee } from "@/lib/scoring";
import * as fs from "fs";
import * as path from "path";

// ──────────────────────────────────────────────
//  API usage tracking helper
// ──────────────────────────────────────────────
async function trackApiUsage(provider: string, count = 1) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.apiUsage.upsert({
    where: { provider_date: { provider, date: today } },
    update: { count: { increment: count } },
    create: { provider, count, date: today },
  });
}

// ──────────────────────────────────────────────
//  Update pipeline run stage
// ──────────────────────────────────────────────
async function updateRun(
  runId: string,
  stage: PipelineStage,
  progress: number,
  errorMessage?: string
) {
  await prisma.pipelineRun.update({
    where: { id: runId },
    data: {
      stage,
      progress,
      errorMessage: errorMessage ?? null,
      finishedAt: stage === PipelineStage.DONE || stage === PipelineStage.FAILED
        ? new Date()
        : undefined,
    },
  });
}

// ──────────────────────────────────────────────
//  Exponential backoff helper
// ──────────────────────────────────────────────
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isRateLimit =
        err instanceof Error &&
        (err.message.includes("429") || err.message.toLowerCase().includes("quota"));
      if (!isRateLimit || attempt === maxAttempts) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[Pipeline] Rate limit, retrying in ${delay}ms…`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ──────────────────────────────────────────────
//  Load mock employees from fixture
// ──────────────────────────────────────────────
function loadMockEmployees(): RawEmployee[] {
  const fixturePath = path.join(process.cwd(), "fixtures", "employees.sample.json");
  return JSON.parse(fs.readFileSync(fixturePath, "utf-8")) as RawEmployee[];
}

// ──────────────────────────────────────────────
//  Main pipeline runner
// ──────────────────────────────────────────────
export async function runPipeline(
  companyLinkedinUrl: string,
  pipelineRunId: string
): Promise<void> {
  const isMock = env.MOCK_MODE;
  const topN = env.TOP_N;

  try {
    // ── STAGE: COMPANY ──────────────────────────
    await updateRun(pipelineRunId, PipelineStage.COMPANY, 5);

    // Find or create company
    let company = await prisma.company.findUnique({
      where: { linkedinUrl: companyLinkedinUrl },
    });

    if (!company || !company.name) {
      if (isMock) {
        company = await prisma.company.upsert({
          where: { linkedinUrl: companyLinkedinUrl },
          update: {
            name: "Mock Company (MOCK_MODE)",
            website: "https://example.com",
            domain: "example.com",
            industry: "Software Development",
            size: "51-200 employees",
            description: "This is a mock company created in MOCK_MODE. No real API calls were made.",
            location: "Bengaluru, Karnataka, India",
          },
          create: {
            linkedinUrl: companyLinkedinUrl,
            name: "Mock Company (MOCK_MODE)",
            website: "https://example.com",
            domain: "example.com",
            industry: "Software Development",
            size: "51-200 employees",
            description: "This is a mock company created in MOCK_MODE. No real API calls were made.",
            location: "Bengaluru, Karnataka, India",
          },
        });
      } else {
        const { scrapeCompany, extractDomain, extractHQLocation, extractIndustry } =
          await import("@/lib/apify/companyClient");
        const { data, rawJson } = await withRetry(() =>
          scrapeCompany(companyLinkedinUrl)
        );
        await trackApiUsage("apify_company");
        const domain = extractDomain(data.website);
        const location = extractHQLocation(data.locations);
        const industry = extractIndustry(data.industries);
        company = await prisma.company.upsert({
          where: { linkedinUrl: companyLinkedinUrl },
          update: {
            name: data.name ?? null,
            website: data.website ?? null,
            domain,
            industry,
            size: data.employeeCount?.toString() ?? null,
            description: data.description ?? null,
            location,
            rawJson,
          },
          create: {
            linkedinUrl: companyLinkedinUrl,
            name: data.name ?? null,
            website: data.website ?? null,
            domain,
            industry,
            size: data.employeeCount?.toString() ?? null,
            description: data.description ?? null,
            location,
            rawJson,
          },
        });
      }
    }

    // Update pipelineRun with companyId if not set (it's already set in create)
    await updateRun(pipelineRunId, PipelineStage.EMPLOYEES, 15);

    // ── STAGE: EMPLOYEES ───────────────────────
    const existingEmployeeCount = await prisma.employee.count({
      where: { companyId: company.id },
    });

    let rawEmployees: RawEmployee[];

    if (existingEmployeeCount > 0) {
      console.log("[Pipeline] Using cached employees");
      rawEmployees = (
        await prisma.employee.findMany({ where: { companyId: company.id } })
      ).map((e) => e.rawJson as unknown as RawEmployee);
    } else if (isMock) {
      rawEmployees = loadMockEmployees();
    } else {
      const { scrapeEmployees } = await import("@/lib/apify/employeesClient");
      rawEmployees = await withRetry(() =>
        scrapeEmployees(companyLinkedinUrl, env.MAX_EMPLOYEES_SCRAPE)
      );
      await trackApiUsage("apify_employees", rawEmployees.length);
    }

    // ── STAGE: SCORING ─────────────────────────
    await updateRun(pipelineRunId, PipelineStage.SCORING, 35);

    const topScored = scoreAndSelectEmployees(rawEmployees, topN);

    // Upsert all employees into DB — run in parallel (independent writes)
    await Promise.all(
      topScored.map((scored) =>
        prisma.employee.upsert({
          where: {
            companyId_linkedinUrl: {
              companyId: company.id,
              linkedinUrl: scored.raw.linkedinUrl,
            },
          },
          update: {
            relevanceScore: scored.relevanceScore,
            scoreReason: scored.scoreReason,
            roleCategory: scored.roleCategory,
            isTop: true,
          },
          create: {
            companyId: company.id,
            firstName: scored.raw.firstName,
            lastName: scored.raw.lastName,
            headline: scored.raw.headline ?? null,
            currentTitle: scored.currentTitle,
            location: scored.location,
            linkedinUrl: scored.raw.linkedinUrl,
            about: scored.raw.about ?? null,
            skillsJson: scored.skillsJson,
            experienceJson: scored.experienceJson,
            hiring: scored.raw.hiring ?? null,
            openToWork: scored.raw.openToWork ?? null,
            roleCategory: scored.roleCategory,
            relevanceScore: scored.relevanceScore,
            scoreReason: scored.scoreReason,
            isTop: true,
            rawJson: scored.raw as object,
          },
        })
      )
    );

    // ── STAGE: EMAILS ──────────────────────────
    await updateRun(pipelineRunId, PipelineStage.EMAILS, 55);

    const topEmployees = await prisma.employee.findMany({
      where: { companyId: company.id, isTop: true },
      include: { emailLookups: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    const emailFinder = getEmailFinder();
    const domain = company.domain ?? "example.com";

    // Determine provider name once (used for usage tracking)
    const providerName = env.FINDYMAIL_API_KEY
      ? "findymail"
      : env.PROSPEO_API_KEY
      ? "prospeo"
      : env.TOMBA_API_KEY
      ? "tomba"
      : env.HUNTER_API_KEY
      ? "hunter"
      : "pattern_guesser";

    // Run all email lookups in parallel — each is an independent HTTP call
    const EMAIL_CONCURRENCY = 5;
    const needsLookup = topEmployees.filter((e) => e.emailLookups.length === 0);

    for (let i = 0; i < needsLookup.length; i += EMAIL_CONCURRENCY) {
      const batch = needsLookup.slice(i, i + EMAIL_CONCURRENCY);
      await Promise.allSettled(
        batch.map(async (emp) => {
          let lookupEmail: string | null = null;
          let lookupStatus: EmailStatus = EmailStatus.NOT_FOUND;
          let confidence: number | null = null;
          let source = "none";

          if (isMock) {
            const isHR = emp.roleCategory === RoleCategory.HR_RECRUITER;
            lookupEmail = isHR
              ? `${emp.firstName.toLowerCase()}.${emp.lastName.toLowerCase()}@${domain}`
              : null;
            lookupStatus = isHR ? EmailStatus.FOUND : EmailStatus.NOT_FOUND;
            source = isHR ? "findymail (mock)" : "none";
            confidence = isHR ? 90 : null;
          } else {
            const rawObj = emp.rawJson as Record<string, unknown> | null;
            const profileEmails = Array.isArray(rawObj?.emails)
              ? (rawObj.emails as string[])
              : [];

            try {
              const result = await withRetry(() =>
                emailFinder.find({
                  firstName: emp.firstName,
                  lastName: emp.lastName,
                  domain,
                  linkedinUrl: emp.linkedinUrl,
                  profileEmails,
                })
              );
              await trackApiUsage(providerName);
              lookupEmail = result.email;
              lookupStatus = result.status as EmailStatus;
              confidence = result.confidence;
              source = result.source;
            } catch (emailErr) {
              console.warn(`[Pipeline] Email lookup failed for ${emp.firstName}:`, emailErr);
              lookupStatus = EmailStatus.ERROR;
              source = "error";
            }
          }

          await prisma.emailLookup.create({
            data: {
              employeeId: emp.id,
              email: lookupEmail,
              status: lookupStatus,
              confidence,
              source,
            },
          });
        })
      );
    }

    // ── STAGE: DRAFTS ──────────────────────────
    await updateRun(pipelineRunId, PipelineStage.DRAFTS, 75);

    // Load settings for sender profile
    const settings = await prisma.settings.findUnique({
      where: { id: "singleton" },
    });

    const freshEmployees = await prisma.employee.findMany({
      where: { companyId: company.id, isTop: true },
      include: {
        emailDrafts: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    // Generate drafts with concurrency of 5 (Gemini calls are independent)
    const queue = freshEmployees.filter((e) => e.emailDrafts.length === 0);
    const CONCURRENCY = 5;

    for (let i = 0; i < queue.length; i += CONCURRENCY) {
      const batch = queue.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (emp) => {
          try {
            let subject: string;
            let body: string;
            let model: string;

            if (isMock || !env.GEMINI_API_KEY) {
              subject = `Full Stack Developer opportunity — ${emp.firstName}`;
              body = buildMockBody(emp, settings);
              model = env.GEMINI_API_KEY ? "mock" : "template-fallback";
            } else {
              try {
                const result = await withRetry(() =>
                  generateEmail({
                    firstName: emp.firstName,
                    lastName: emp.lastName,
                    headline: emp.headline ?? null,
                    currentTitle: emp.currentTitle ?? null,
                    about: emp.about ?? null,
                    skills: (emp.skillsJson as string[]) ?? [],
                    recentExperience: ((emp.experienceJson as Array<{
                      position?: string;
                      companyName?: string;
                    }>) ?? []).slice(0, 2),
                    hiring: emp.hiring ?? null,
                    roleCategory: emp.roleCategory,
                    senderName: settings?.name ?? "Muhammed Safwan",
                    senderRole: settings?.role ?? "Full Stack Developer",
                    senderLocation: settings?.location ?? "Bengaluru, India",
                    senderStack: settings?.techStack ?? "Next.js, React, TypeScript",
                    senderPortfolio: settings?.portfolioUrl ?? "https://www.muhammadsafwan.com/",
                    senderExperience: settings?.experience ?? "",
                    senderEducation: settings?.education ?? "",
                  })
                );
                await trackApiUsage("gemini");
                subject = result.subject;
                body = result.body;
                model = env.GEMINI_MODEL;
              } catch (geminiErr) {
                console.warn(`[Pipeline] Gemini failed for ${emp.firstName}, falling back to template draft:`, geminiErr);
                subject = `Full Stack Developer opportunity — ${emp.firstName}`;
                body = buildMockBody(emp, settings);
                model = "template-fallback";
              }
            }

            await prisma.emailDraft.create({
              data: {
                employeeId: emp.id,
                subject,
                body,
                model,
                status: DraftStatus.DRAFT,
              },
            });
          } catch (err) {
            console.error(`[Pipeline] Failed to generate draft for ${emp.firstName}:`, err);
          }
        })
      );

      // Progress update
      const done = Math.min(i + CONCURRENCY, queue.length);
      const pct = 75 + Math.round((done / queue.length) * 20);
      await updateRun(pipelineRunId, PipelineStage.DRAFTS, pct);
    }

    // ── DONE ──────────────────────────────────
    await updateRun(pipelineRunId, PipelineStage.DONE, 100);
    console.log(`[Pipeline] ✅ Done for company ${company.name}`);
  } catch (err) {
    console.error("[Pipeline] ❌ Failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    await prisma.pipelineRun.update({
      where: { id: pipelineRunId },
      data: {
        stage: PipelineStage.FAILED,
        errorMessage: message,
        finishedAt: new Date(),
      },
    });
  }
}

// ──────────────────────────────────────────────
//  Mock body builder
// ──────────────────────────────────────────────
function buildMockBody(
  emp: { firstName: string; currentTitle: string | null; roleCategory: string },
  settings: { name: string; portfolioUrl: string } | null
): string {
  const name = settings?.name ?? "Muhammed Safwan";
  const portfolio = settings?.portfolioUrl ?? "https://www.muhammadsafwan.com/";
  const role = emp.roleCategory;
  const firstName = emp.firstName;

  const ask =
    role === "HR_RECRUITER"
      ? "I wanted to reach out regarding any Full Stack Developer openings you might be hiring for."
      : role === "FOUNDER_EXEC"
      ? "I'd love to learn more about engineering opportunities at your company."
      : role === "ENGINEERING_LEAD"
      ? "I'm exploring software engineering roles and would love to know if there are any openings on your team."
      : "I'm exploring Full Stack Developer roles and would appreciate any guidance or referrals you might have.";

  return `Hi ${firstName},

I came across your profile on LinkedIn and noticed you're ${emp.currentTitle ?? "working"} at this company. ${ask}

I'm a Full Stack Developer based in Bengaluru, recently graduated with experience in Next.js, React, TypeScript, Node.js, Express.js, and PostgreSQL. I've completed both freelance projects and a Full Stack Developer internship.

My resume is attached. Portfolio: ${portfolio}

Best regards,
${name}
Full Stack Developer
Bengaluru, India`;
}
