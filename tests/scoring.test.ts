import { describe, it, expect } from "vitest";
import {
  classifyRole,
  scoreEmployee,
  selectTopN,
  scoreAndSelectEmployees,
  type RawEmployee,
} from "../lib/scoring";
import { RoleCategory } from "@prisma/client";

// ──────────────────────────────────────────────
//  classifyRole
// ──────────────────────────────────────────────
describe("classifyRole", () => {
  it("classifies HR keywords", () => {
    expect(classifyRole("Technical Recruiter at Acme", null)).toBe(RoleCategory.HR_RECRUITER);
    expect(classifyRole("Talent Acquisition Specialist", null)).toBe(RoleCategory.HR_RECRUITER);
    expect(classifyRole("HR Business Partner | People Ops", null)).toBe(RoleCategory.HR_RECRUITER);
    expect(classifyRole("Hiring Manager", null)).toBe(RoleCategory.HR_RECRUITER);
  });

  it("classifies founder / exec keywords", () => {
    expect(classifyRole("Co-Founder & CTO", null)).toBe(RoleCategory.FOUNDER_EXEC);
    expect(classifyRole("CEO at Startup Inc", null)).toBe(RoleCategory.FOUNDER_EXEC);
    expect(classifyRole("Managing Director", null)).toBe(RoleCategory.FOUNDER_EXEC);
  });

  it("classifies engineering lead keywords", () => {
    expect(classifyRole("Engineering Manager | React | Node", null)).toBe(
      RoleCategory.ENGINEERING_LEAD
    );
    expect(classifyRole("Head of Engineering", null)).toBe(RoleCategory.ENGINEERING_LEAD);
    expect(classifyRole("VP Engineering", null)).toBe(RoleCategory.ENGINEERING_LEAD);
    expect(classifyRole("Tech Lead", null)).toBe(RoleCategory.ENGINEERING_LEAD);
  });

  it("classifies software engineer keywords", () => {
    expect(classifyRole("Full Stack Developer", null)).toBe(RoleCategory.SOFTWARE_ENGINEER);
    expect(classifyRole("Frontend Engineer | React | TypeScript", null)).toBe(
      RoleCategory.SOFTWARE_ENGINEER
    );
    expect(classifyRole("Backend Developer", null)).toBe(RoleCategory.SOFTWARE_ENGINEER);
    expect(classifyRole("SDE II at Amazon", null)).toBe(RoleCategory.SOFTWARE_ENGINEER);
  });

  it("classifies OTHER for unrelated roles", () => {
    expect(classifyRole("Marketing Manager", null)).toBe(RoleCategory.OTHER);
    expect(classifyRole("Finance Analyst", null)).toBe(RoleCategory.OTHER);
    expect(classifyRole("Sales Director", null)).toBe(RoleCategory.OTHER);
  });

  it("prefers HR over other roles when both match", () => {
    // HR takes priority over engineering
    expect(classifyRole("HR Tech Lead | Talent Acquisition", null)).toBe(
      RoleCategory.HR_RECRUITER
    );
  });
});

// ──────────────────────────────────────────────
//  scoreEmployee
// ──────────────────────────────────────────────
describe("scoreEmployee", () => {
  const baseEmployee: RawEmployee = {
    firstName: "Test",
    lastName: "User",
    headline: "Software Engineer",
    linkedinUrl: "https://linkedin.com/in/test",
  };

  it("gives HR role a high base score", () => {
    const emp: RawEmployee = { ...baseEmployee, headline: "Technical Recruiter" };
    const { relevanceScore, roleCategory } = scoreEmployee(emp);
    expect(roleCategory).toBe(RoleCategory.HR_RECRUITER);
    expect(relevanceScore).toBeGreaterThanOrEqual(50);
  });

  it("adds hiring bonus", () => {
    const empNoHiring: RawEmployee = { ...baseEmployee, headline: "Technical Recruiter", hiring: false };
    const empHiring: RawEmployee = { ...baseEmployee, headline: "Technical Recruiter", hiring: true };
    const { relevanceScore: noHiringScore } = scoreEmployee(empNoHiring);
    const { relevanceScore: hiringScore } = scoreEmployee(empHiring);
    expect(hiringScore).toBeGreaterThan(noHiringScore);
  });

  it("adds India/Bengaluru location bonus", () => {
    const empIndia: RawEmployee = {
      ...baseEmployee,
      headline: "Software Engineer",
      location: { linkedinText: "Bengaluru, Karnataka, India" },
    };
    const empUS: RawEmployee = {
      ...baseEmployee,
      headline: "Software Engineer",
      location: { linkedinText: "San Francisco, CA, United States" },
    };
    const { relevanceScore: indiaScore } = scoreEmployee(empIndia);
    const { relevanceScore: usScore } = scoreEmployee(empUS);
    expect(indiaScore).toBeGreaterThan(usScore);
  });

  it("adds stack overlap bonus", () => {
    const empWithStack: RawEmployee = {
      ...baseEmployee,
      headline: "Software Engineer",
      skills: [{ name: "React" }, { name: "Next.js" }, { name: "TypeScript" }],
    };
    const empNoStack: RawEmployee = {
      ...baseEmployee,
      headline: "Software Engineer",
      skills: [{ name: "Java" }, { name: "Spring Boot" }],
    };
    const { relevanceScore: stackScore } = scoreEmployee(empWithStack);
    const { relevanceScore: noStackScore } = scoreEmployee(empNoStack);
    expect(stackScore).toBeGreaterThan(noStackScore);
  });

  it("penalises openToWork", () => {
    const empOTW: RawEmployee = {
      ...baseEmployee,
      headline: "Software Engineer",
      openToWork: true,
    };
    const empNotOTW: RawEmployee = {
      ...baseEmployee,
      headline: "Software Engineer",
      openToWork: false,
    };
    const { relevanceScore: otwScore } = scoreEmployee(empOTW);
    const { relevanceScore: notOtwScore } = scoreEmployee(empNotOTW);
    expect(otwScore).toBeLessThan(notOtwScore);
  });

  it("gives OTHER role a near-zero base score", () => {
    const emp: RawEmployee = { ...baseEmployee, headline: "Marketing Coordinator" };
    const { relevanceScore } = scoreEmployee(emp);
    expect(relevanceScore).toBeLessThanOrEqual(15);
  });

  it("score never exceeds 100", () => {
    const emp: RawEmployee = {
      ...baseEmployee,
      headline: "Technical Recruiter | Talent Acquisition",
      hiring: true,
      openToWork: false,
      location: { linkedinText: "Bengaluru, India" },
      about: "Experienced recruiter with 10 years of experience hiring tech talent.",
      skills: [
        { name: "React" },
        { name: "Next.js" },
        { name: "TypeScript" },
        { name: "Node.js" },
        { name: "PostgreSQL" },
      ],
    };
    const { relevanceScore } = scoreEmployee(emp);
    expect(relevanceScore).toBeLessThanOrEqual(100);
  });

  it("derives currentTitle from most recent Present experience", () => {
    const emp: RawEmployee = {
      ...baseEmployee,
      headline: "Software Engineer",
      experience: [
        { position: "Lead Engineer", companyName: "A", endDate: { text: "Present" } },
        { position: "Junior Engineer", companyName: "B", endDate: { text: "Jan 2022" } },
      ],
    };
    const { currentTitle } = scoreEmployee(emp);
    expect(currentTitle).toBe("Lead Engineer");
  });
});

// ──────────────────────────────────────────────
//  selectTopN with diversity
// ──────────────────────────────────────────────
describe("selectTopN", () => {
  const makeEmployee = (
    headline: string,
    score: number
  ): import("../lib/scoring").ScoredEmployee => ({
    raw: {
      firstName: "Test",
      lastName: "User",
      headline,
      linkedinUrl: `https://linkedin.com/in/test-${score}`,
    },
    roleCategory: classifyRole(headline, null),
    relevanceScore: score,
    scoreReason: "test",
    currentTitle: null,
    location: null,
    skillsJson: [],
    experienceJson: [],
  });

  it("selects up to N employees", () => {
    const emps = Array.from({ length: 15 }, (_, i) =>
      makeEmployee("Software Engineer", 50 - i)
    );
    const top = selectTopN(emps, 10);
    expect(top).toHaveLength(10);
  });

  it("ensures HR/recruiter appears if available", () => {
    const emps = [
      makeEmployee("Software Engineer", 80),
      makeEmployee("Software Engineer", 75),
      makeEmployee("Technical Recruiter", 40), // lower score but should be picked
      ...Array.from({ length: 7 }, (_, i) => makeEmployee("Backend Developer", 60 - i)),
    ];
    const top = selectTopN(emps, 5);
    const hasHR = top.some((e) => e.roleCategory === RoleCategory.HR_RECRUITER);
    expect(hasHR).toBe(true);
  });

  it("ensures founder appears if available", () => {
    const emps = [
      ...Array.from({ length: 8 }, (_, i) => makeEmployee("Software Engineer", 70 - i)),
      makeEmployee("CEO & Founder", 30), // low score but should be picked
    ];
    const top = selectTopN(emps, 5);
    const hasFounder = top.some((e) => e.roleCategory === RoleCategory.FOUNDER_EXEC);
    expect(hasFounder).toBe(true);
  });
});

// ──────────────────────────────────────────────
//  scoreAndSelectEmployees (integration)
// ──────────────────────────────────────────────
describe("scoreAndSelectEmployees", () => {
  it("returns top N scored employees", () => {
    const employees: RawEmployee[] = Array.from({ length: 20 }, (_, i) => ({
      firstName: `Person${i}`,
      lastName: "Test",
      headline: i % 3 === 0 ? "Technical Recruiter" : "Software Engineer",
      linkedinUrl: `https://linkedin.com/in/person${i}`,
    }));

    const result = scoreAndSelectEmployees(employees, 10);
    expect(result).toHaveLength(10);
    result.forEach((e) => {
      expect(e.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(e.relevanceScore).toBeLessThanOrEqual(100);
    });
  });
});
