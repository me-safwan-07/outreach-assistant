import { PrismaClient, RoleCategory, EmailStatus, DraftStatus, PipelineStage } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { scoreAndSelectEmployees } from "../lib/scoring";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // Upsert singleton Settings row
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      name: "Muhammed Safwan",
      role: "Full Stack Developer",
      location: "Bengaluru, India",
      education: "Recently graduated, B.Com in Computer Applications",
      experience: "Freelance Full Stack Developer; completed a Full Stack Developer internship",
      techStack: "Next.js, React, TypeScript, Node.js, Express.js, PostgreSQL, Prisma, Tailwind CSS",
      portfolioUrl: "https://www.muhammadsafwan.com/",
      maxApifyCalls: 100,
      maxHunterCalls: 25,
      maxGeminiCalls: 100,
    },
  });
  console.log("✅ Settings upserted");

  // Create a mock company
  const company = await prisma.company.upsert({
    where: { linkedinUrl: "https://www.linkedin.com/company/techcorp-india" },
    update: {},
    create: {
      linkedinUrl: "https://www.linkedin.com/company/techcorp-india",
      name: "TechCorp India",
      website: "https://techcorp.example.com",
      domain: "techcorp.example.com",
      industry: "Software Development",
      size: "51-200 employees",
      description:
        "TechCorp India is a fast-growing B2B SaaS company building developer tools and workflow automation products for engineering teams across Asia.",
      location: "Bengaluru, Karnataka, India",
    },
  });
  console.log(`✅ Company: ${company.name} (${company.id})`);

  // Create a completed pipeline run
  await prisma.pipelineRun.create({
    data: {
      companyId: company.id,
      stage: PipelineStage.DONE,
      progress: 100,
      finishedAt: new Date(),
    },
  });

  // Load fixture employees
  const fixturePath = path.join(process.cwd(), "fixtures", "employees.sample.json");
  const rawEmployees = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));

  // Score them
  const topEmployees = scoreAndSelectEmployees(rawEmployees, 10);

  // Insert employees with email lookups and draft emails
  for (const scored of topEmployees) {
    const emp = await prisma.employee.upsert({
      where: {
        companyId_linkedinUrl: {
          companyId: company.id,
          linkedinUrl: scored.raw.linkedinUrl,
        },
      },
      update: {},
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
    });

    // Mock email lookup
    const isHR = scored.roleCategory === RoleCategory.HR_RECRUITER;
    const email = isHR
      ? `${scored.raw.firstName.toLowerCase()}.${scored.raw.lastName.toLowerCase()}@techcorp.example.com`
      : null;

    await prisma.emailLookup.create({
      data: {
        employeeId: emp.id,
        email,
        status: isHR ? EmailStatus.FOUND : EmailStatus.NOT_FOUND,
        confidence: isHR ? 87 : null,
        source: isHR ? "Hunter.io (mock)" : null,
      },
    });

    // Mock draft email
    const firstName = scored.raw.firstName;
    const roleLabel = scored.roleCategory.replace(/_/g, " ").toLowerCase();
    await prisma.emailDraft.create({
      data: {
        employeeId: emp.id,
        subject: `Full Stack Developer opportunity — ${firstName}`,
        body: `Hi ${firstName},\n\nI came across your profile and noticed you're ${scored.currentTitle ?? "working"} at TechCorp India. ${scored.roleCategory === RoleCategory.HR_RECRUITER ? "I wanted to reach out regarding any Full Stack Developer openings you might be hiring for." : scored.roleCategory === RoleCategory.FOUNDER_EXEC ? "I'd love to connect and discuss any engineering opportunities at TechCorp." : "I'm exploring software engineering opportunities and would appreciate any guidance or referrals you might have."}\n\nI'm a Full Stack Developer based in Bengaluru with experience in Next.js, React, TypeScript, Node.js, and PostgreSQL. My resume is attached.\n\nPortfolio: https://www.muhammadsafwan.com/\n\nBest regards,\nMuhammed Safwan\nFull Stack Developer\nBengaluru, India`,
        model: "mock",
        status: DraftStatus.DRAFT,
      },
    });

    console.log(
      `  ✅ ${scored.raw.firstName} ${scored.raw.lastName} — ${scored.roleCategory} (score: ${scored.relevanceScore})`
    );
  }

  console.log("\n🎉 Seed complete! Run 'pnpm dev' and go to http://localhost:3000");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
