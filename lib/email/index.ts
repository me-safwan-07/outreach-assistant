import { env } from "@/lib/env";
import { FindymailEmailFinder } from "./findymailProvider";
import { ProspeoEmailFinder } from "./prospeoProvider";
import { TombaEmailFinder } from "./tombaProvider";
import { HunterEmailFinder } from "./hunterProvider";
import type { EmailFinder, EmailFinderInput, EmailResult } from "./types";
import { guessEmail } from "./types";

class CompositeEmailFinder implements EmailFinder {
  private primary: EmailFinder;

  constructor() {
    if (env.EMAIL_PROVIDER === "findymail" || (env.EMAIL_PROVIDER === "auto" && env.FINDYMAIL_API_KEY)) {
      this.primary = new FindymailEmailFinder(env.FINDYMAIL_API_KEY);
    } else if (env.EMAIL_PROVIDER === "prospeo" || (env.EMAIL_PROVIDER === "auto" && env.PROSPEO_API_KEY)) {
      this.primary = new ProspeoEmailFinder(env.PROSPEO_API_KEY);
    } else if (env.EMAIL_PROVIDER === "tomba" || (env.EMAIL_PROVIDER === "auto" && env.TOMBA_API_KEY)) {
      this.primary = new TombaEmailFinder(env.TOMBA_API_KEY, env.TOMBA_API_SECRET);
    } else if (env.EMAIL_PROVIDER === "hunter" || (env.EMAIL_PROVIDER === "auto" && env.HUNTER_API_KEY)) {
      this.primary = new HunterEmailFinder(env.HUNTER_API_KEY);
    } else if (env.FINDYMAIL_API_KEY) {
      this.primary = new FindymailEmailFinder(env.FINDYMAIL_API_KEY);
    } else if (env.PROSPEO_API_KEY) {
      this.primary = new ProspeoEmailFinder(env.PROSPEO_API_KEY);
    } else if (env.TOMBA_API_KEY) {
      this.primary = new TombaEmailFinder(env.TOMBA_API_KEY, env.TOMBA_API_SECRET);
    } else {
      // Default to Findymail finder (falls back to pattern guess if no key)
      this.primary = new FindymailEmailFinder(env.FINDYMAIL_API_KEY);
    }
  }

  async find(input: EmailFinderInput): Promise<EmailResult> {
    // 1. If email was found directly on LinkedIn profile by Apify
    if (input.profileEmails && input.profileEmails.length > 0) {
      const valid = input.profileEmails.find((e) => e && e.includes("@"));
      if (valid) {
        return {
          email: valid,
          status: "FOUND",
          confidence: 100,
          source: "LinkedIn Profile (Apify)",
        };
      }
    }

    // 2. Query configured finder
    return this.primary.find(input);
  }
}

let _finder: EmailFinder | null = null;

export function getEmailFinder(): EmailFinder {
  if (!_finder) {
    _finder = new CompositeEmailFinder();
  }
  return _finder;
}

export { guessEmail } from "./types";
export { FindymailEmailFinder } from "./findymailProvider";
export { ProspeoEmailFinder } from "./prospeoProvider";
export { TombaEmailFinder } from "./tombaProvider";
export { HunterEmailFinder } from "./hunterProvider";
export type { EmailFinder, EmailFinderInput, EmailResult, EmailResultStatus } from "./types";
