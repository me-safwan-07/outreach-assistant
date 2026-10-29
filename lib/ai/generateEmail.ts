import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { env } from "@/lib/env";

// Singleton client — avoid re-instantiation on every call
let _aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!_aiClient) _aiClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return _aiClient;
}

// ──────────────────────────────────────────────
//  Zod schema for Gemini JSON output
// ──────────────────────────────────────────────
export const EmailOutputSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(50).max(2000),
});

export type EmailOutput = z.infer<typeof EmailOutputSchema>;

// ──────────────────────────────────────────────
//  Input type — minimal payload to save tokens
// ──────────────────────────────────────────────
export interface EmailGenerationInput {
  // About the recipient
  firstName: string;
  lastName: string;
  headline: string | null;
  currentTitle: string | null;
  about: string | null; // truncated to 500 chars
  skills: string[]; // top 10
  recentExperience: Array<{ position?: string; companyName?: string }>; // first 2
  hiring: boolean | null;
  roleCategory: string;
  // About the sender (from Settings)
  senderName: string;
  senderRole: string;
  senderLocation: string;
  senderStack: string;
  senderPortfolio: string;
  senderExperience: string;
  senderEducation: string;
}

const SYSTEM_PROMPT = `You are my professional cold-email assistant. I give you my profile and one person's LinkedIn data. Write a short, personalized cold email from me to them.

Rules:
- 120 to 180 words. Professional, concise, natural, human, confident but not arrogant.
- Greeting "Hi {firstName},". No "Dear Sir/Madam". No excessive flattery. No buzzwords. No fake familiarity. Do not ask for a job aggressively.
- Personalize using ONE or TWO specific facts from their data (current role, company, a project or achievement in their experience, a skill). Never write generic lines like "I was impressed by your profile."
- Use ONLY the provided data. Never invent openings, projects, technologies, shared connections, company facts, or email addresses. If data is missing, don't mention it.
- Only say they are hiring if \`hiring\` is explicitly true.
- Tailor the ask by role:
  - Founder/CEO: ask about opportunities at their company and whether they are open to connecting with developers.
  - Engineering Manager/Tech Lead: focus on engineering opportunities and ask if they know of relevant openings.
  - Software/Full Stack Engineer: mention their technical background and ask for guidance or a referral.
  - Recruiter/HR: ask directly about relevant openings and the application process.
  - Other roles: connect my development background to their area and ask to be pointed to the right person.
- Structure: opening (why I found them + one specific detail), my intro connected to their team, the request (Full Stack/Frontend/software engineering roles, or the right person), "my resume is attached", portfolio link, then sign-off.
- Sign-off exactly: "Best regards,\\nMuhammed Safwan\\nFull Stack Developer\\nBengaluru, India"

Return valid JSON only: { "subject": "...", "body": "..." }`;

// ──────────────────────────────────────────────
//  Generate email with retry
// ──────────────────────────────────────────────
export async function generateEmail(
  input: EmailGenerationInput
): Promise<EmailOutput> {
  const ai = getAiClient();

  const userPrompt = buildPrompt(input);

  async function attempt(): Promise<EmailOutput> {
    const response = await ai.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens: 600,
      },
    });

    const raw = response.text ?? "";

    // Strip markdown code fences if present
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    const json = JSON.parse(cleaned);
    return EmailOutputSchema.parse(json);
  }

  try {
    return await attempt();
  } catch (firstErr) {
    console.warn("[Gemini] First attempt failed, retrying once:", firstErr);
    try {
      return await attempt();
    } catch (secondErr) {
      console.error("[Gemini] Both attempts failed:", secondErr);
      throw secondErr;
    }
  }
}

function buildPrompt(input: EmailGenerationInput): string {
  const {
    firstName,
    lastName,
    headline,
    currentTitle,
    about,
    skills,
    recentExperience,
    hiring,
    roleCategory,
    senderName,
    senderRole,
    senderLocation,
    senderStack,
    senderPortfolio,
    senderExperience,
    senderEducation,
  } = input;

  const aboutTruncated = about ? about.slice(0, 500) : null;

  return JSON.stringify({
    recipient: {
      firstName,
      lastName,
      headline,
      currentTitle,
      about: aboutTruncated,
      topSkills: skills.slice(0, 10),
      recentExperience: recentExperience.slice(0, 2),
      hiring: hiring ?? false,
      roleCategory,
    },
    sender: {
      name: senderName,
      role: senderRole,
      location: senderLocation,
      stack: senderStack,
      portfolio: senderPortfolio,
      experience: senderExperience,
      education: senderEducation,
    },
  });
}
