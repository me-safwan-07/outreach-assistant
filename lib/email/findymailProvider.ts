import { z } from "zod";
import type { EmailFinder, EmailFinderInput, EmailResult } from "./types";
import { guessEmail } from "./types";

const FindymailResponseSchema = z.object({
  contact: z
    .object({
      name: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      domain: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

export class FindymailEmailFinder implements EmailFinder {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async find(input: EmailFinderInput): Promise<EmailResult> {
    const { firstName, lastName, domain, profileEmails, linkedinUrl } = input;

    // 1. If email already existed on LinkedIn profile
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

    // 2. If no API key provided, fall back to pattern guess
    if (!this.apiKey) {
      return {
        email: guessEmail(firstName, lastName, domain),
        status: "GUESSED_UNVERIFIED",
        confidence: null,
        source: "pattern-guess (no API key)",
      };
    }

    const fullName = `${firstName} ${lastName}`.trim();

    try {
      const headers = {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      let email: string | null | undefined = null;

      // 1. Try finding by LinkedIn URL if available
      if (linkedinUrl && linkedinUrl.includes("linkedin.com/in/")) {
        try {
          const liRes = await fetch("https://app.findymail.com/api/search/find-person", {
            method: "POST",
            headers,
            body: JSON.stringify({ linkedin_url: linkedinUrl }),
            signal: AbortSignal.timeout(10_000),
          });
          if (liRes.ok) {
            const liJson = await liRes.json().catch(() => ({}));
            const liParsed = FindymailResponseSchema.safeParse(liJson);
            if (liParsed.success && liParsed.data.contact?.email) {
              email = liParsed.data.contact.email;
            }
          }
        } catch (liErr) {
          console.warn("[Findymail] LinkedIn lookup error, falling back to name/domain:", liErr);
        }
      }

      // 2. If not found by LinkedIn URL, search by name + domain
      if (!email) {
        const res = await fetch("https://app.findymail.com/api/search/name", {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: fullName,
            domain,
          }),
          signal: AbortSignal.timeout(10_000),
        });

        if (res.status === 429) {
          console.warn("[Findymail] Rate limited");
          return {
            email: guessEmail(firstName, lastName, domain),
            status: "GUESSED_UNVERIFIED",
            confidence: null,
            source: "pattern-guess (Findymail rate limited)",
          };
        }

        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          const parsed = FindymailResponseSchema.safeParse(json);
          if (parsed.success && parsed.data.contact?.email) {
            email = parsed.data.contact.email;
          }
        }
      }

      if (!email) {
        return {
          email: guessEmail(firstName, lastName, domain),
          status: "GUESSED_UNVERIFIED",
          confidence: null,
          source: "pattern-guess (Findymail no email found)",
        };
      }

      return {
        email,
        status: "FOUND",
        confidence: 98,
        source: "Findymail",
      };
    } catch (err) {
      console.error("[Findymail] Network error:", err);
      return {
        email: guessEmail(firstName, lastName, domain),
        status: "GUESSED_UNVERIFIED",
        confidence: null,
        source: "pattern-guess (Findymail network error)",
      };
    }
  }
}
