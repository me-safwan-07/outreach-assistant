import { z } from "zod";
import type { EmailFinder, EmailFinderInput, EmailResult } from "./types";
import { guessEmail } from "./types";

const TombaResponseSchema = z.object({
  data: z
    .object({
      email: z.string().nullable().optional(),
      score: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
  errors: z
    .array(
      z.object({
        message: z.string().optional(),
      })
    )
    .optional(),
});

export class TombaEmailFinder implements EmailFinder {
  private apiKey: string;
  private apiSecret: string;

  constructor(apiKey: string, apiSecret: string = "") {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  async find(input: EmailFinderInput): Promise<EmailResult> {
    const { firstName, lastName, domain, profileEmails } = input;

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
      const url = new URL("https://api.tomba.io/v1/email-finder");
      url.searchParams.set("domain", domain);
      url.searchParams.set("first_name", firstName);
      url.searchParams.set("last_name", lastName);

      const headers: Record<string, string> = {
        Accept: "application/json",
        "X-Tomba-Key": this.apiKey,
      };
      if (this.apiSecret) {
        headers["X-Tomba-Secret"] = this.apiSecret;
      }

      const res = await fetch(url.toString(), {
        headers,
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        return {
          email: guessEmail(firstName, lastName, domain),
          status: "GUESSED_UNVERIFIED",
          confidence: null,
          source: `pattern-guess (Tomba HTTP ${res.status})`,
        };
      }

      const json = await res.json().catch(() => ({}));
      const parsed = TombaResponseSchema.safeParse(json);

      if (!parsed.success) {
        return {
          email: guessEmail(firstName, lastName, domain),
          status: "GUESSED_UNVERIFIED",
          confidence: null,
          source: "pattern-guess (Tomba parse warning)",
        };
      }

      const email = parsed.data.data?.email;
      if (!email) {
        return {
          email: guessEmail(firstName, lastName, domain),
          status: "GUESSED_UNVERIFIED",
          confidence: null,
          source: "pattern-guess (Tomba not found)",
        };
      }

      return {
        email,
        status: "FOUND",
        confidence: parsed.data.data?.score ?? 90,
        source: "Tomba.io",
      };
    } catch (err) {
      console.error("[Tomba] Network error:", err);
      return {
        email: guessEmail(firstName, lastName, domain),
        status: "GUESSED_UNVERIFIED",
        confidence: null,
        source: "pattern-guess (Tomba network error)",
      };
    }
  }
}
