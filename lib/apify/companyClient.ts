import { ApifyClient } from "apify-client";
import { z } from "zod";
import { env } from "@/lib/env";

const client = new ApifyClient({ token: env.APIFY_TOKEN });

// ──────────────────────────────────────────────
//  Output schema (key fields only)
// ──────────────────────────────────────────────
const LocationParsedSchema = z
  .object({ text: z.string().optional() })
  .optional();

const IndustryItemSchema = z.union([
  z.string(),
  z.object({
    name: z.string().optional(),
    title: z.string().optional(),
  }),
]);

const CompanyOutputSchema = z.object({
  linkedinUrl: z.string().optional(),
  name: z.string().optional(),
  website: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  employeeCount: z.number().optional(),
  employeeCountRange: z.object({ start: z.number().optional() }).optional(),
  industries: z.array(IndustryItemSchema).optional(),
  locations: z
    .array(
      z.object({
        headquarter: z.boolean().optional(),
        parsed: LocationParsedSchema,
      })
    )
    .optional(),
  companyType: z.string().nullable().optional(),
});

export type ApifyCompanyResult = z.infer<typeof CompanyOutputSchema>;

// ──────────────────────────────────────────────
//  Scrape company details
// ──────────────────────────────────────────────
export async function scrapeCompany(
  linkedinUrl: string
): Promise<{ data: ApifyCompanyResult; rawJson: object }> {
  const run = await client.actor(env.APIFY_COMPANY_ACTOR_ID).call({
    companies: [linkedinUrl],
  });

  const { items } = await client
    .dataset(run.defaultDatasetId)
    .listItems({ limit: 1 });

  if (!items.length) {
    throw new Error(`Apify company actor returned no results for ${linkedinUrl}`);
  }

  const raw = items[0] as Record<string, unknown>;
  const parsed = CompanyOutputSchema.safeParse(raw);

  if (!parsed.success) {
    console.warn("[Apify Company] Parse warning:", parsed.error.flatten());
    // Return raw even if schema is off — be resilient
    return {
      data: raw as ApifyCompanyResult,
      rawJson: raw,
    };
  }

  return { data: parsed.data, rawJson: raw };
}

// Helper to extract domain from website URL
export function extractDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const url = new URL(
      website.startsWith("http") ? website : `https://${website}`
    );
    return url.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// Helper to get HQ location text
export function extractHQLocation(
  locations: ApifyCompanyResult["locations"]
): string | null {
  if (!locations?.length) return null;
  const hq =
    locations.find((l) => l.headquarter) ?? locations[0];
  return hq?.parsed?.text ?? null;
}

// Helper to extract industry string
export function extractIndustry(
  industries: ApifyCompanyResult["industries"]
): string | null {
  if (!industries?.length) return null;
  const first = industries[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object") {
    return first.name ?? first.title ?? null;
  }
  return null;
}
