import { z } from "zod";
import type { EmailFinder, EmailFinderInput, EmailResult } from "./types";
import { guessEmail } from "./types";

// Hunter.io API v2 response schema
const HunterResponseSchema = z.object({
  data: z
    .object({
      email: z.string().nullable().optional(),
      confidence: z.number().nullable().optional(),
      result: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  errors: z
    .array(
      z.object({
        details: z.string().optional(),
        id: z.string().optional(),
      })
    )
    .optional(),
});

export class HunterEmailFinder implements EmailFinder {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async find(input: EmailFinderInput): Promise<EmailResult> {
    const { firstName, lastName, domain } = input;

    if (!this.apiKey) {
      return {
        email: guessEmail(firstName, lastName, domain),
        status: "GUESSED_UNVERIFIED",
        confidence: null,
        source: "pattern-guess (no API key)",
      };
    }

    const url = new URL("https://api.hunter.io/v2/email-finder");
    url.searchParams.set("domain", domain);
    url.searchParams.set("first_name", firstName);
    url.searchParams.set("last_name", lastName);
    url.searchParams.set("api_key", this.apiKey);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      console.error("[Hunter] Network error:", err);
      return {
        email: null,
        status: "ERROR",
        confidence: null,
        source: "Hunter.io (network error)",
      };
    }

    // Handle rate limit
    if (response.status === 429) {
      console.warn("[Hunter] Rate limit hit");
      return {
        email: null,
        status: "ERROR",
        confidence: null,
        source: "Hunter.io (rate limited)",
      };
    }

    const json = await response.json().catch(() => ({}));
    const parsed = HunterResponseSchema.safeParse(json);

    if (!parsed.success) {
      console.error("[Hunter] Unexpected response shape:", json);
      return {
        email: null,
        status: "ERROR",
        confidence: null,
        source: "Hunter.io (parse error)",
      };
    }

    const data = parsed.data.data;
    const email = data?.email ?? null;

    if (!email) {
      // Fallback to pattern guess
      const guessed = guessEmail(firstName, lastName, domain);
      return {
        email: guessed,
        status: "GUESSED_UNVERIFIED",
        confidence: null,
        source: "pattern-guess (Hunter returned no result)",
      };
    }

    return {
      email,
      status: "FOUND",
      confidence: data?.confidence ?? null,
      source: "Hunter.io",
    };
  }
}
