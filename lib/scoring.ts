import { RoleCategory } from "@prisma/client";

export interface RawEmployee {
  id?: string;
  firstName: string;
  lastName: string;
  headline?: string | null;
  about?: string | null;
  openToWork?: boolean | null;
  hiring?: boolean | null;
  location?: { linkedinText?: string } | null;
  linkedinUrl: string;
  emails?: string[] | null;
  experience?: Array<{
    position?: string;
    companyName?: string;
    skills?: string[];
    endDate?: { text?: string } | null;
  }> | null;
  skills?: Array<{ name: string }> | null;
}

export interface ScoredEmployee {
  raw: RawEmployee;
  roleCategory: RoleCategory;
  relevanceScore: number;
  scoreReason: string;
  currentTitle: string | null;
  location: string | null;
  skillsJson: string[];
  experienceJson: Array<{
    position?: string;
    companyName?: string;
    skills?: string[];
    endDate?: { text?: string } | null;
  }>;
}

// My tech stack for overlap scoring
const MY_STACK = new Set([
  "next.js",
  "nextjs",
  "react",
  "typescript",
  "node.js",
  "nodejs",
  "express",
  "express.js",
  "postgresql",
  "postgres",
  "prisma",
  "tailwind",
  "tailwindcss",
  "javascript",
]);

const INDIA_KEYWORDS = ["india", "bengaluru", "bangalore", "mumbai", "delhi", "hyderabad", "chennai", "pune"];

// ──────────────────────────────────────────────
//  Role classification
// ──────────────────────────────────────────────
export function classifyRole(
  headline: string | null | undefined,
  currentTitle: string | null | undefined
): RoleCategory {
  const text = `${headline ?? ""} ${currentTitle ?? ""}`.toLowerCase();

  // Priority 1 — HR / Recruiter / Talent
  if (
    /\b(hr|human resources?|recruit(er|ing|ment)|talent acquisition|people ops?|people operations?|staffing|hiring manager)\b/.test(
      text
    )
  ) {
    return RoleCategory.HR_RECRUITER;
  }

  // Priority 2 — Founder / Exec
  if (
    /\b(founder|co-founder|ceo|chief executive|cto|chief technology|owner|proprietor|director general|managing director)\b/.test(
      text
    )
  ) {
    return RoleCategory.FOUNDER_EXEC;
  }

  // Priority 3 — Engineering lead
  if (
    /\b(engineering manager|head of engineering|vp (of )?engineering|vice president (of )?engineering|tech lead|technical lead|principal engineer|staff engineer|engineering director|director of engineering)\b/.test(
      text
    )
  ) {
    return RoleCategory.ENGINEERING_LEAD;
  }

  // Priority 4 — Software engineer / developer
  if (
    /\b(software engineer|full.?stack|frontend|front.?end|backend|back.?end|web developer|react developer|node developer|javascript developer|typescript|developer|programmer|sde|swe)\b/.test(
      text
    )
  ) {
    return RoleCategory.SOFTWARE_ENGINEER;
  }

  return RoleCategory.OTHER;
}

// ──────────────────────────────────────────────
//  Score a single employee (0–100)
// ──────────────────────────────────────────────
export function scoreEmployee(emp: RawEmployee): {
  roleCategory: RoleCategory;
  relevanceScore: number;
  scoreReason: string;
  currentTitle: string | null;
  location: string | null;
  skillsJson: string[];
} {
  const locationText = emp.location?.linkedinText ?? null;

  // Derive current title from first experience entry still "Present"
  const currentTitle =
    emp.experience?.find((e) => e.endDate?.text === "Present")?.position ??
    emp.experience?.[0]?.position ??
    null;

  const role = classifyRole(emp.headline, currentTitle);

  const reasons: string[] = [];
  let score = 0;

  // Base score by role category
  switch (role) {
    case RoleCategory.HR_RECRUITER:
      score += 50;
      reasons.push("HR/Recruiter role");
      break;
    case RoleCategory.FOUNDER_EXEC:
      score += 40;
      reasons.push("Founder/Exec role");
      break;
    case RoleCategory.ENGINEERING_LEAD:
      score += 35;
      reasons.push("Engineering lead");
      break;
    case RoleCategory.SOFTWARE_ENGINEER:
      score += 25;
      reasons.push("Software engineer");
      break;
    default:
      score += 2;
      reasons.push("Other role");
  }

  // Bonus: is hiring
  if (emp.hiring === true) {
    score += 15;
    reasons.push("actively hiring");
  }

  // Bonus: India / Bengaluru location
  const locLower = (locationText ?? "").toLowerCase();
  if (INDIA_KEYWORDS.some((kw) => locLower.includes(kw))) {
    score += 10;
    reasons.push("India location");
  }

  // Bonus: tech stack overlap
  const allSkills: string[] = [
    ...(emp.skills?.map((s) => s.name.toLowerCase()) ?? []),
    ...(emp.experience?.flatMap((e) => e.skills?.map((s) => s.toLowerCase()) ?? []) ?? []),
    (emp.headline ?? "").toLowerCase(),
  ];
  const overlap = allSkills.filter((s) => MY_STACK.has(s));
  if (overlap.length > 0) {
    const bonus = Math.min(overlap.length * 3, 15);
    score += bonus;
    reasons.push(`stack overlap (${[...new Set(overlap)].slice(0, 3).join(", ")})`);
  }

  // Bonus: has "about" section
  if (emp.about && emp.about.length > 50) {
    score += 5;
    reasons.push("has about section");
  }

  // Penalty: openToWork (they are job-seeking too)
  if (emp.openToWork === true) {
    score = Math.max(0, score - 8);
    reasons.push("(open to work penalty)");
  }

  const skillsJson = emp.skills?.map((s) => s.name) ?? [];

  return {
    roleCategory: role,
    relevanceScore: Math.min(score, 100),
    scoreReason: reasons.join(", "),
    currentTitle,
    location: locationText,
    skillsJson,
  };
}

// ──────────────────────────────────────────────
//  Select top N with diversity guarantee
// ──────────────────────────────────────────────
export function selectTopN(
  employees: ScoredEmployee[],
  n: number = 10
): ScoredEmployee[] {
  const sorted = [...employees].sort(
    (a, b) => b.relevanceScore - a.relevanceScore
  );

  // Greedy diversity: ensure at least 1 HR/recruiter and 1 founder/exec if available
  const result: ScoredEmployee[] = [];
  const usedIndices = new Set<number>();

  // First pass: grab the highest-scored HR/recruiter
  const hrIdx = sorted.findIndex(
    (e) => e.roleCategory === RoleCategory.HR_RECRUITER
  );
  if (hrIdx >= 0) {
    result.push(sorted[hrIdx]);
    usedIndices.add(hrIdx);
  }

  // Second pass: grab the highest-scored founder/exec
  const founderIdx = sorted.findIndex(
    (e, i) =>
      !usedIndices.has(i) && e.roleCategory === RoleCategory.FOUNDER_EXEC
  );
  if (founderIdx >= 0) {
    result.push(sorted[founderIdx]);
    usedIndices.add(founderIdx);
  }

  // Fill the rest by score
  for (let i = 0; i < sorted.length && result.length < n; i++) {
    if (!usedIndices.has(i)) {
      result.push(sorted[i]);
      usedIndices.add(i);
    }
  }

  return result.slice(0, n);
}

// ──────────────────────────────────────────────
//  Score all and select top N — main entry point
// ──────────────────────────────────────────────
export function scoreAndSelectEmployees(
  rawEmployees: RawEmployee[],
  topN: number = 10
): ScoredEmployee[] {
  const scored: ScoredEmployee[] = rawEmployees.map((emp) => {
    const result = scoreEmployee(emp);
    return {
      raw: emp,
      ...result,
      experienceJson:
        emp.experience?.map((e) => ({
          position: e.position,
          companyName: e.companyName,
          skills: e.skills,
          endDate: e.endDate,
        })) ?? [],
    };
  });

  return selectTopN(scored, topN);
}
