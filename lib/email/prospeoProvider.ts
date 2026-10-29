import { z } from "zod";
import type { EmailFinder, EmailFinderInput, EmailResult } from "./types";
import { guessEmail } from "./types";

const ProspeoResponseSchema = z.object({
  error: z.boolean().optional(),
  message: z.string().optional(),
  response: z
    .object({
      email: z
        .object({
          email: z.string().nullable().optional(),
          status: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
      person: z
        .object({
          email: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
});

export class ProspeoEmailFinder implements EmailFinder {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async find(input: EmailFinderInput): Promise<EmailResult> {
    const { firstName, lastName, domain, profileEmails } = input;

    // Check if email already existed on LinkedIn profile
    if (profileEmails && profileEmails.length > 0) {
      const valid = profileEmails.find((e) => e && e.includes("@"));
      if (valid) {
        return {
          email: valid,
          status: "FOUND",
          confidence: 100,
          source: "LinkedIn Profile (Apify)",
        };
      }
    }

    if (!this.apiKey) {
      return {
        email: guessEmail(firstName, lastName, domain),
        status: "GUESSED_UNVERIFIED",
        confidence: null,
        source: "pattern-guess (no API key)",
      };
    }

    try {
      const res = await fetch("https://api.prospeo.io/enrich-person", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-KEY": this.apiKey,
        },
        body: JSON.stringify({
          only_verified_email: true,
          enrich_mobile: false,
          data: {
            first_name: firstName,
            last_name: lastName,
            company_website: domain,
          },
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.status === 429) {
        console.warn("[Prospeo] Rate limited");
        return {
          email: guessEmail(firstName, lastName, domain),
          status: "GUESSED_UNVERIFIED",
          confidence: null,
          source: "pattern-guess (Prospeo rate limited)",
        };
      }

      if (!res.ok) {
        console.warn(`[Prospeo] HTTP error ${res.status}`);
        return {
          email: guessEmail(firstName, lastName, domain),
          status: "GUESSED_UNVERIFIED",
          confidence: null,
          source: `pattern-guess (Prospeo HTTP ${res.status})`,
        };
      }

      const json = await res.json().catch(() => ({}));
      const parsed = ProspeoResponseSchema.safeParse(json);

      if (!parsed.success) {
        console.warn("[Prospeo] Parse warning:", parsed.error.issues[0]);
        return {
          email: guessEmail(firstName, lastName, domain),
          status: "GUESSED_UNVERIFIED",
          confidence: null,
          source: "pattern-guess (Prospeo parse error)",
        };
      }

      const email =
        parsed.data.response?.email?.email ||
        parsed.data.response?.person?.email ||
        null;

      if (!email) {
        return {
          email: guessEmail(firstName, lastName, domain),
          status: "GUESSED_UNVERIFIED",
          confidence: null,
          source: "pattern-guess (Prospeo no email found)",
        };
      }

      return {
        email,
        status: "FOUND",
        confidence: 95,
        source: "Prospeo",
      };
    } catch (err) {
      console.error("[Prospeo] Network error:", err);
      return {
        email: guessEmail(firstName, lastName, domain),
        status: "GUESSED_UNVERIFIED",
        confidence: null,
        source: "pattern-guess (Prospeo network error)",
      };
    }
  }
}
