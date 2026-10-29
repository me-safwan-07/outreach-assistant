// Email finder provider interface — swap implementations without changing callers

export type EmailResultStatus =
  | "FOUND"
  | "NOT_FOUND"
  | "GUESSED_UNVERIFIED"
  | "ERROR";

export interface EmailFinderInput {
  firstName: string;
  lastName: string;
  domain: string;
  linkedinUrl?: string;
  profileEmails?: string[];
}

export interface EmailResult {
  email: string | null;
  status: EmailResultStatus;
  confidence: number | null;
  source: string;
}

export interface EmailFinder {
  find(input: EmailFinderInput): Promise<EmailResult>;
}

// ──────────────────────────────────────────────
//  Guess email pattern (always GUESSED_UNVERIFIED)
// ──────────────────────────────────────────────
export function guessEmail(
  firstName: string,
  lastName: string,
  domain: string
): string {
  const f = firstName.toLowerCase().replace(/[^a-z]/g, "");
  const l = lastName.toLowerCase().replace(/[^a-z]/g, "");
  return `${f}.${l}@${domain}`;
}
