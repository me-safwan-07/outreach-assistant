import { ApifyClient } from "apify-client";
import { z } from "zod";
import { env } from "@/lib/env";
import type { RawEmployee } from "@/lib/scoring";

const client = new ApifyClient({ token: env.APIFY_TOKEN });

// ──────────────────────────────────────────────
//  Resilient Employee Normalizer
// ──────────────────────────────────────────────
export function normalizeApifyEmployee(item: Record<string, unknown>): RawEmployee | null {
  if (!item || typeof item !== "object") return null;

  const firstName = String(item.firstName || "").trim();
  const lastName = String(item.lastName || "").trim();
  const linkedinUrl = String(
    item.linkedinUrl ||
      (item.publicIdentifier
        ? `https://www.linkedin.com/in/${item.publicIdentifier}`
        : "")
  ).trim();

  // Basic requirement: need a LinkedIn URL and at least a first name or last name
  if (!linkedinUrl || (!firstName && !lastName)) return null;

  // Normalize location
  let locationLinkedinText: string | undefined = undefined;
  if (typeof item.location === "string") {
    locationLinkedinText = item.location;
  } else if (item.location && typeof item.location === "object") {
    const locObj = item.location as Record<string, unknown>;
    locationLinkedinText =
      typeof locObj.linkedinText === "string"
        ? locObj.linkedinText
        : typeof (locObj.parsed as Record<string, unknown>)?.text === "string"
        ? ((locObj.parsed as Record<string, unknown>).text as string)
        : undefined;
  }

  // Normalize experience (support both 'experience' and 'currentPosition')
  const rawExp = Array.isArray(item.experience) && item.experience.length > 0
    ? item.experience
    : Array.isArray(item.currentPosition)
    ? item.currentPosition
    : [];

  const experience = rawExp.map((exp: unknown) => {
    if (!exp || typeof exp !== "object") return {};
    const e = exp as Record<string, unknown>;
    const skillsList = Array.isArray(e.skills)
      ? e.skills
          .map((s) => (typeof s === "string" ? s : typeof (s as Record<string, unknown>)?.name === "string" ? (s as Record<string, unknown>).name as string : ""))
          .filter(Boolean)
      : [];

    let endDateText: string | undefined = undefined;
    if (typeof e.endDate === "string") {
      endDateText = e.endDate;
    } else if (e.endDate && typeof e.endDate === "object") {
      endDateText = typeof (e.endDate as Record<string, unknown>).text === "string"
        ? (e.endDate as Record<string, unknown>).text as string
        : undefined;
    }

    return {
      position: typeof e.position === "string" ? e.position : undefined,
      companyName: typeof e.companyName === "string" ? e.companyName : undefined,
      skills: skillsList,
      endDate: endDateText ? { text: endDateText } : null,
    };
  });

  // Normalize skills (support both 'skills' and 'topSkills')
  const rawSkills = Array.isArray(item.skills) && item.skills.length > 0
    ? item.skills
    : Array.isArray(item.topSkills)
    ? item.topSkills
    : [];

  const skills = rawSkills
    .map((s: unknown) => {
      if (typeof s === "string") return { name: s };
      if (s && typeof s === "object" && typeof (s as Record<string, unknown>).name === "string") {
        return { name: (s as Record<string, unknown>).name as string };
      }
      return null;
    })
    .filter((s): s is { name: string } => s !== null);

  const rawEmails = Array.isArray(item.emails)
    ? (item.emails as unknown[])
        .map((e) =>
          typeof e === "string"
            ? e
            : e && typeof e === "object" && typeof (e as Record<string, unknown>).email === "string"
            ? ((e as Record<string, unknown>).email as string)
            : ""
        )
        .filter((e) => e.includes("@"))
    : [];

  return {
    id: typeof item.id === "string" ? item.id : undefined,
    firstName: firstName || "Unknown",
    lastName: lastName || "",
    headline: typeof item.headline === "string" ? item.headline : null,
    about: typeof item.about === "string" ? item.about : null,
    openToWork: typeof item.openToWork === "boolean" ? item.openToWork : null,
    hiring: typeof item.hiring === "boolean" ? item.hiring : null,
    location: locationLinkedinText ? { linkedinText: locationLinkedinText } : null,
    linkedinUrl,
    emails: rawEmails.length > 0 ? rawEmails : null,
    experience: experience.length > 0 ? experience : null,
    skills: skills.length > 0 ? skills : null,
  };
}

// ──────────────────────────────────────────────
//  Normalizer for apt_marble output schema
//  Fields: name, headline, location, profileUrl, companyName, source, scrapedAt
// ──────────────────────────────────────────────
export function normalizeAptMarbleEmployee(item: Record<string, unknown>): RawEmployee | null {
  if (!item || typeof item !== "object") return null;

  const fullName = typeof item.name === "string" ? item.name.trim() : "";
  const profileUrl = typeof item.profileUrl === "string" ? item.profileUrl.trim() : "";

  if (!fullName || !profileUrl) return null;

  const spaceIdx = fullName.indexOf(" ");
  const firstName = spaceIdx > -1 ? fullName.slice(0, spaceIdx) : fullName;
  const lastName = spaceIdx > -1 ? fullName.slice(spaceIdx + 1) : "";

  const headline = typeof item.headline === "string" ? item.headline.trim() : null;
  const location = typeof item.location === "string" && item.location.trim()
    ? item.location.trim()
    : null;

  return {
    id: undefined,
    firstName,
    lastName,
    headline: headline || null,
    about: null,
    openToWork: null,
    hiring: null,
    location: location ? { linkedinText: location } : null,
    linkedinUrl: profileUrl,
    emails: null,
    experience: null,
    skills: null,
  };
}

// ──────────────────────────────────────────────
//  Normalizer for apimaestro output schema
//  Fields: profile_url, first_name, last_name, headline,
//          public_identifier, location{full}, open_to_work
// ──────────────────────────────────────────────
export function normalizeApiMaestroEmployee(item: Record<string, unknown>): RawEmployee | null {
  if (!item || typeof item !== "object") return null;

  const firstName = String(item.first_name || "").trim();
  const lastName  = String(item.last_name  || "").trim();

  // Reject bogus "undefined" string that the actor sometimes returns
  const cleanLastName = lastName === "undefined" ? "" : lastName;

  // Build LinkedIn URL: prefer profile_url, fall back to public_identifier
  const profileUrl = String(item.profile_url || "").trim();
  const publicId   = String(item.public_identifier || "").trim();
  const linkedinUrl =
    profileUrl ||
    (publicId ? `https://www.linkedin.com/in/${publicId}` : "");

  if (!linkedinUrl || !firstName) return null;

  // Location: the actor returns an object { country, city, full, ... }
  let locationText: string | undefined;
  if (typeof item.location === "string") {
    locationText = item.location || undefined;
  } else if (item.location && typeof item.location === "object") {
    const loc = item.location as Record<string, unknown>;
    locationText =
      typeof loc.full === "string" && loc.full
        ? loc.full
        : typeof loc.city === "string" && loc.city
        ? loc.city
        : undefined;
  }

  return {
    id: typeof item.urn === "string" ? item.urn : undefined,
    firstName,
    lastName: cleanLastName,
    headline: typeof item.headline === "string" ? item.headline : null,
    about: null,
    openToWork: typeof item.open_to_work === "boolean" ? item.open_to_work : null,
    hiring: null,
    location: locationText ? { linkedinText: locationText } : null,
    linkedinUrl,
    emails: null,
    experience: null,
    skills: null,
  };
}

// ──────────────────────────────────────────────
//  Scrape employees for a company
// ──────────────────────────────────────────────
export async function scrapeEmployees(
  companyLinkedinUrl: string,
  maxItems: number = env.MAX_EMPLOYEES_SCRAPE
): Promise<RawEmployee[]> {
  const run = await client.actor(env.APIFY_EMPLOYEES_ACTOR_ID).call({
    identifier: companyLinkedinUrl, // accepts full URL or slug
    max_employees: maxItems,
    job_title: "",                  // empty = all job titles
  });

  const { items } = await client
    .dataset(run.defaultDatasetId)
    .listItems({ limit: maxItems });

  console.log(`[Apify Employees] Actor returned ${items.length} items from dataset ${run.defaultDatasetId}`);

  const employees: RawEmployee[] = [];

  for (const item of items) {
    const raw = item as Record<string, unknown>;

    // Route to the right normalizer based on unique field fingerprints:
    //   apimaestro  → has snake_case "profile_url" field
    //   apt_marble  → has camelCase "profileUrl" field
    //   harvestapi  → fallback (camelCase firstName/linkedinUrl)
    const normalized =
      typeof raw.profile_url === "string"
        ? normalizeApiMaestroEmployee(raw)
        : typeof raw.profileUrl === "string"
        ? normalizeAptMarbleEmployee(raw)
        : normalizeApifyEmployee(raw);

    if (!normalized) {
      console.warn("[Apify Employees] Skipping unparseable item:", item);
      continue;
    }
    employees.push(normalized);
  }

  console.log(`[Apify Employees] Successfully normalized ${employees.length} / ${items.length} employees`);
  return employees;
}
