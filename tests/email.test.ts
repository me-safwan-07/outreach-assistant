import { describe, it, expect } from "vitest";
import { guessEmail } from "../lib/email/types";
import { FindymailEmailFinder } from "../lib/email/findymailProvider";
import { ProspeoEmailFinder } from "../lib/email/prospeoProvider";
import { TombaEmailFinder } from "../lib/email/tombaProvider";

describe("guessEmail", () => {
  it("produces first.last@domain pattern", () => {
    expect(guessEmail("John", "Doe", "example.com")).toBe("john.doe@example.com");
  });

  it("lowercases names", () => {
    expect(guessEmail("PRIYA", "SHARMA", "techcorp.com")).toBe("priya.sharma@techcorp.com");
  });

  it("strips non-alpha chars from names", () => {
    expect(guessEmail("Jean-Pierre", "O'Brien", "acme.io")).toBe("jeanpierre.obrien@acme.io");
  });

  it("handles single-char first names", () => {
    expect(guessEmail("A", "Kumar", "startup.in")).toBe("a.kumar@startup.in");
  });

  it("preserves subdomain in domain", () => {
    expect(guessEmail("Rahul", "Gupta", "mail.company.com")).toBe("rahul.gupta@mail.company.com");
  });
});

describe("EmailOutput validation (Gemini parser)", () => {
  // Simulate what the Gemini JSON parser must validate
  const { z } = require("zod");
  const EmailOutputSchema = z.object({
    subject: z.string().min(1).max(200),
    body: z.string().min(50).max(2000),
  });

  it("accepts valid subject and body", () => {
    const result = EmailOutputSchema.safeParse({
      subject: "Full Stack Developer opportunity",
      body: "Hi Priya,\n\nI came across your profile and noticed you are a Technical Recruiter at TechCorp. I am a Full Stack Developer based in Bengaluru with experience in Next.js and React. I wanted to ask if there are any open Full Stack Developer roles at your company. My resume is attached.\n\nPortfolio: https://www.muhammadsafwan.com/\n\nBest regards,\nMuhammed Safwan\nFull Stack Developer\nBengaluru, India",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty subject", () => {
    const result = EmailOutputSchema.safeParse({ subject: "", body: "valid body ".repeat(5) });
    expect(result.success).toBe(false);
  });

  it("rejects body that is too short", () => {
    const result = EmailOutputSchema.safeParse({ subject: "Test", body: "Too short" });
    expect(result.success).toBe(false);
  });

  it("rejects body that is too long", () => {
    const result = EmailOutputSchema.safeParse({
      subject: "Test",
      body: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    const result = EmailOutputSchema.safeParse({ subject: "Only subject" });
    expect(result.success).toBe(false);
  });

  it("strips markdown code fences simulation", () => {
    const raw = '```json\n{"subject":"Hello","body":"' + "A valid email body that is long enough to pass the minimum check and include all required content for a professional outreach message." + '"}\n```';
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    const result = EmailOutputSchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });
});

describe("ProspeoEmailFinder", () => {
  it("returns pattern guess when no API key is provided", async () => {
    const finder = new ProspeoEmailFinder("");
    const result = await finder.find({
      firstName: "Lavanya",
      lastName: "Meduri",
      domain: "webomindapps.com",
    });

    expect(result.status).toBe("GUESSED_UNVERIFIED");
    expect(result.email).toBe("lavanya.meduri@webomindapps.com");
  });

  it("returns LinkedIn profile email directly if available", async () => {
    const finder = new ProspeoEmailFinder("");
    const result = await finder.find({
      firstName: "John",
      lastName: "Doe",
      domain: "company.com",
      profileEmails: ["john.doe.personal@gmail.com"],
    });

    expect(result.status).toBe("FOUND");
    expect(result.email).toBe("john.doe.personal@gmail.com");
    expect(result.confidence).toBe(100);
  });
});

describe("TombaEmailFinder", () => {
  it("returns pattern guess when no API key is provided", async () => {
    const finder = new TombaEmailFinder("");
    const result = await finder.find({
      firstName: "Vivek",
      lastName: "Maurya",
      domain: "webomindapps.com",
    });

    expect(result.status).toBe("GUESSED_UNVERIFIED");
    expect(result.email).toBe("vivek.maurya@webomindapps.com");
  });
});

describe("FindymailEmailFinder", () => {
  it("returns pattern guess when no API key is provided", async () => {
    const finder = new FindymailEmailFinder("");
    const result = await finder.find({
      firstName: "Lavanya",
      lastName: "Meduri",
      domain: "webomindapps.com",
    });

    expect(result.status).toBe("GUESSED_UNVERIFIED");
    expect(result.email).toBe("lavanya.meduri@webomindapps.com");
  });

  it("returns LinkedIn profile email directly if available", async () => {
    const finder = new FindymailEmailFinder("");
    const result = await finder.find({
      firstName: "Elon",
      lastName: "Musk",
      domain: "tesla.com",
      profileEmails: ["elon@tesla.com"],
    });

    expect(result.status).toBe("FOUND");
    expect(result.email).toBe("elon@tesla.com");
    expect(result.confidence).toBe(100);
  });
});
