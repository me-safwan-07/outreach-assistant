import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export type TimeFilterRange = "daily" | "weekly" | "monthly" | "all";

interface TimeBucket {
  timestamp: string;
  label: string;
  fullDate: string;
  contacts: number;
  emailsFound: number;
  drafts: number;
  sent: number;
  replied: number;
  totalActivity: number;
}

function calculateGrowth(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) return { change: 0, text: "0%", positive: null };
    return { change: 100, text: "+100%", positive: true };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  return {
    change: pct,
    text: pct > 0 ? `+${pct}%` : `${pct}%`,
    positive: pct >= 0,
  };
}

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  FOUNDER_EXEC: "Founders & Execs",
  ENGINEERING_LEAD: "Engineering Leads",
  SOFTWARE_ENGINEER: "Software Engineers",
  HR_RECRUITER: "Recruiters & Talent",
  OTHER: "Other Roles",
};

const DRAFT_STATUS_NAMES: Record<string, string> = {
  DRAFT: "Ready Drafts",
  COPIED: "Copied to Clipboard",
  SENT: "Sent Outreach",
  REPLIED: "Positive Replies",
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rangeParam = (searchParams.get("range") || "weekly").toLowerCase() as TimeFilterRange;
    const range: TimeFilterRange = ["daily", "weekly", "monthly", "all"].includes(rangeParam)
      ? rangeParam
      : "weekly";

    const now = new Date();
    let start: Date;
    let prevStart: Date;
    let bucketCount: number;
    let bucketType: "hour" | "day" | "week";

    if (range === "daily") {
      // Last 24 hours
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      prevStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      bucketCount = 24;
      bucketType = "hour";
    } else if (range === "weekly") {
      // Last 7 days
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      prevStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      bucketCount = 7;
      bucketType = "day";
    } else if (range === "monthly") {
      // Last 30 days
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      prevStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      bucketCount = 30;
      bucketType = "day";
    } else {
      // All time (window of last 90 days for chart resolution)
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      prevStart = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      bucketCount = 12;
      bucketType = "week";
    }

    // ── Run parallel queries ──────────────────────────────────────────
    const [
      // Lifetime metrics
      allTimeCompanies,
      allTimeEmployees,
      allTimeEmailFound,
      allTimeSent,
      allTimeDrafts,
      allTimeReplied,
      allTimeEmailLookups,

      // Current period counts
      periodCompanies,
      periodEmployees,
      periodEmailFound,
      periodSent,
      periodDrafts,
      periodReplied,
      periodEmailLookups,

      // Previous period counts (for growth)
      prevCompanies,
      prevEmployees,
      prevEmailFound,
      prevSent,
      prevDrafts,
      prevReplied,

      // Records with timestamps for time-series charts
      timeSeriesEmployees,
      timeSeriesLookups,
      timeSeriesDrafts,

      // Distributions
      roleGroups,
      draftGroups,

      // Settings limits
      settings,

      // Recent activity
      recentRuns,
      topCompanies,
      recentSent,

      // API usage in period
      apiUsageRaw,
    ] = await Promise.all([
      // Lifetime totals
      prisma.company.count(),
      prisma.employee.count(),
      prisma.emailLookup.count({ where: { status: "FOUND" } }),
      prisma.emailDraft.count({ where: { status: "SENT" } }),
      prisma.emailDraft.count(),
      prisma.emailDraft.count({ where: { status: "REPLIED" } }),
      prisma.emailLookup.count(),

      // Selected period counts
      range === "all"
        ? prisma.company.count()
        : prisma.company.count({ where: { createdAt: { gte: start } } }),
      range === "all"
        ? prisma.employee.count()
        : prisma.employee.count({ where: { createdAt: { gte: start } } }),
      range === "all"
        ? prisma.emailLookup.count({ where: { status: "FOUND" } })
        : prisma.emailLookup.count({ where: { status: "FOUND", createdAt: { gte: start } } }),
      range === "all"
        ? prisma.emailDraft.count({ where: { status: { in: ["SENT", "REPLIED"] } } })
        : prisma.emailDraft.count({
            where: {
              status: { in: ["SENT", "REPLIED"] },
              updatedAt: { gte: start },
            },
          }),
      range === "all"
        ? prisma.emailDraft.count()
        : prisma.emailDraft.count({ where: { createdAt: { gte: start } } }),
      range === "all"
        ? prisma.emailDraft.count({ where: { status: "REPLIED" } })
        : prisma.emailDraft.count({
            where: { status: "REPLIED", updatedAt: { gte: start } },
          }),
      range === "all"
        ? prisma.emailLookup.count()
        : prisma.emailLookup.count({ where: { createdAt: { gte: start } } }),

      // Previous period counts
      range === "all"
        ? 0
        : prisma.company.count({ where: { createdAt: { gte: prevStart, lt: start } } }),
      range === "all"
        ? 0
        : prisma.employee.count({ where: { createdAt: { gte: prevStart, lt: start } } }),
      range === "all"
        ? 0
        : prisma.emailLookup.count({
            where: { status: "FOUND", createdAt: { gte: prevStart, lt: start } },
          }),
      range === "all"
        ? 0
        : prisma.emailDraft.count({
            where: {
              status: { in: ["SENT", "REPLIED"] },
              updatedAt: { gte: prevStart, lt: start },
            },
          }),
      range === "all"
        ? 0
        : prisma.emailDraft.count({ where: { createdAt: { gte: prevStart, lt: start } } }),
      range === "all"
        ? 0
        : prisma.emailDraft.count({
            where: { status: "REPLIED", updatedAt: { gte: prevStart, lt: start } },
          }),

      // Time series items
      prisma.employee.findMany({
        where: { createdAt: { gte: start } },
        select: { createdAt: true },
      }),
      prisma.emailLookup.findMany({
        where: { createdAt: { gte: start }, status: "FOUND" },
        select: { createdAt: true },
      }),
      prisma.emailDraft.findMany({
        where: {
          OR: [{ createdAt: { gte: start } }, { updatedAt: { gte: start } }],
        },
        select: { createdAt: true, updatedAt: true, status: true },
      }),

      // Distributions
      prisma.employee.groupBy({
        by: ["roleCategory"],
        _count: { id: true },
      }),
      prisma.emailDraft.groupBy({
        by: ["status"],
        _count: { id: true },
      }),

      // Settings
      prisma.settings.findUnique({ where: { id: "singleton" } }),

      // Recent pipeline runs
      prisma.pipelineRun.findMany({
        take: 12,
        orderBy: { startedAt: "desc" },
        include: { company: { select: { name: true, linkedinUrl: true } } },
      }),

      // Top companies
      prisma.company.findMany({
        take: 6,
        orderBy: { employees: { _count: "desc" } },
        select: {
          id: true,
          name: true,
          industry: true,
          location: true,
          _count: { select: { employees: true } },
        },
      }),

      // Recent sent emails
      prisma.emailDraft.findMany({
        where: { status: { in: ["SENT", "REPLIED"] } },
        take: 12,
        orderBy: { updatedAt: "desc" },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              currentTitle: true,
              company: { select: { id: true, name: true } },
            },
          },
        },
      }),

      // API usage
      prisma.apiUsage.findMany({
        where: {
          date: { gte: start },
        },
        orderBy: { date: "asc" },
      }),
    ]);

    // ── Generate Time Series Buckets ──────────────────────────────────
    const buckets: TimeBucket[] = [];
    const bucketIntervalMs = (now.getTime() - start.getTime()) / bucketCount;

    for (let i = 0; i < bucketCount; i++) {
      const bStart = new Date(start.getTime() + i * bucketIntervalMs);
      const bEnd = new Date(start.getTime() + (i + 1) * bucketIntervalMs);

      let label = "";
      let fullDate = "";

      if (bucketType === "hour") {
        label = bStart.toLocaleTimeString("en-US", {
          hour: "numeric",
          hour12: true,
        });
        fullDate = bStart.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
      } else if (bucketType === "day") {
        label = bStart.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        fullDate = bStart.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } else {
        label = `W${i + 1} ${bStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
        fullDate = `${bStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${bEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      }

      buckets.push({
        timestamp: bStart.toISOString(),
        label,
        fullDate,
        contacts: 0,
        emailsFound: 0,
        drafts: 0,
        sent: 0,
        replied: 0,
        totalActivity: 0,
      });
    }

    // Helper to find bucket index
    function getBucketIndex(date: Date): number {
      const t = date.getTime();
      if (t < start.getTime()) return -1;
      const idx = Math.floor((t - start.getTime()) / bucketIntervalMs);
      return Math.min(Math.max(0, idx), bucketCount - 1);
    }

    // Populate contacts
    for (const emp of timeSeriesEmployees) {
      const idx = getBucketIndex(emp.createdAt);
      if (idx >= 0 && idx < buckets.length) {
        buckets[idx].contacts++;
        buckets[idx].totalActivity++;
      }
    }

    // Populate emails found
    for (const l of timeSeriesLookups) {
      const idx = getBucketIndex(l.createdAt);
      if (idx >= 0 && idx < buckets.length) {
        buckets[idx].emailsFound++;
        buckets[idx].totalActivity++;
      }
    }

    // Populate drafts, sent, replied
    for (const d of timeSeriesDrafts) {
      if (d.createdAt >= start) {
        const cIdx = getBucketIndex(d.createdAt);
        if (cIdx >= 0 && cIdx < buckets.length) {
          buckets[cIdx].drafts++;
          buckets[cIdx].totalActivity++;
        }
      }
      if (d.updatedAt >= start && (d.status === "SENT" || d.status === "REPLIED")) {
        const sIdx = getBucketIndex(d.updatedAt);
        if (sIdx >= 0 && sIdx < buckets.length) {
          buckets[sIdx].sent++;
          if (d.status === "REPLIED") {
            buckets[sIdx].replied++;
          }
          buckets[sIdx].totalActivity++;
        }
      }
    }

    // ── API usage — group by provider ────────────────────────────────
    const usageByProvider: Record<string, { date: string; count: number }[]> = {};
    const providerTotals: Record<string, number> = {};
    for (const row of apiUsageRaw) {
      const key = row.provider;
      if (!usageByProvider[key]) usageByProvider[key] = [];
      usageByProvider[key].push({
        date: row.date.toISOString().split("T")[0],
        count: row.count,
      });
      providerTotals[key] = (providerTotals[key] || 0) + row.count;
    }

    // Provider Quota calculations
    const maxApify = settings?.maxApifyCalls ?? 100;
    const maxHunter = settings?.maxHunterCalls ?? 25;
    const maxGemini = settings?.maxGeminiCalls ?? 100;

    const apifyUsed = (providerTotals["apify"] || 0) + (providerTotals["apify_employees"] || 0) + (providerTotals["apify_company"] || 0);
    const hunterUsed = providerTotals["hunter"] || 0;
    const geminiUsed = providerTotals["gemini"] || 0;

    const quotaUsage = {
      apify: {
        used: apifyUsed,
        limit: maxApify,
        percentage: Math.min(100, Math.round((apifyUsed / Math.max(1, maxApify)) * 100)),
      },
      hunter: {
        used: hunterUsed,
        limit: maxHunter,
        percentage: Math.min(100, Math.round((hunterUsed / Math.max(1, maxHunter)) * 100)),
      },
      gemini: {
        used: geminiUsed,
        limit: maxGemini,
        percentage: Math.min(100, Math.round((geminiUsed / Math.max(1, maxGemini)) * 100)),
      },
    };

    // ── Role Distribution ────────────────────────────────────────────
    const totalRoleCount = roleGroups.reduce((acc, r) => acc + r._count.id, 0);
    const roleDistribution = roleGroups
      .map((r) => ({
        role: r.roleCategory,
        label: ROLE_DISPLAY_NAMES[r.roleCategory] ?? r.roleCategory,
        count: r._count.id,
        percentage: totalRoleCount > 0 ? Math.round((r._count.id / totalRoleCount) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // ── Draft Status Distribution ────────────────────────────────────
    const totalDraftStatusCount = draftGroups.reduce((acc, d) => acc + d._count.id, 0);
    const statusDistribution = draftGroups
      .map((d) => ({
        status: d.status,
        label: DRAFT_STATUS_NAMES[d.status] ?? d.status,
        count: d._count.id,
        percentage:
          totalDraftStatusCount > 0 ? Math.round((d._count.id / totalDraftStatusCount) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // ── Funnel calculations ──────────────────────────────────────────
    const funnelSteps = [
      { label: "Companies", value: periodCompanies, allTime: allTimeCompanies, color: "#94a3b8" },
      { label: "Contacts", value: periodEmployees, allTime: allTimeEmployees, color: "#a855f7" },
      { label: "Emails Found", value: periodEmailFound, allTime: allTimeEmailFound, color: "#38bdf8" },
      { label: "Drafts", value: periodDrafts, allTime: allTimeDrafts, color: "#f59e0b" },
      { label: "Sent", value: periodSent, allTime: allTimeSent, color: "#4ade80" },
      { label: "Replied", value: periodReplied, allTime: allTimeReplied, color: "#10b981" },
    ];

    // ── Conversion Rates ─────────────────────────────────────────────
    const draftSuccessRate =
      periodDrafts > 0 ? Math.round((periodSent / periodDrafts) * 100) : 0;
    const emailFindRate =
      periodEmailLookups > 0 ? Math.round((periodEmailFound / periodEmailLookups) * 100) : 0;
    const replyRate =
      periodSent > 0 ? Math.round((periodReplied / periodSent) * 100) : 0;

    // ── Dynamic Actionable Insights ──────────────────────────────────
    const insights: Array<{ type: "success" | "info" | "warning"; title: string; desc: string }> = [];

    if (emailFindRate >= 60) {
      insights.push({
        type: "success",
        title: "High Email Discovery Rate",
        desc: `${emailFindRate}% of looked-up contacts have verified deliverable email addresses.`,
      });
    } else if (emailFindRate > 0) {
      insights.push({
        type: "info",
        title: "Email Discovery Rate",
        desc: `${emailFindRate}% find rate. Consider enabling additional waterfall providers in Settings.`,
      });
    }

    const pendingDraftsCount = (draftGroups.find((g) => g.status === "DRAFT")?._count.id) ?? 0;
    if (pendingDraftsCount > 0) {
      insights.push({
        type: "info",
        title: `${pendingDraftsCount} Ready Drafts Pending Review`,
        desc: "You have generated personalized pitches ready to be inspected and sent.",
      });
    }

    const topRole = roleDistribution[0];
    if (topRole) {
      insights.push({
        type: "info",
        title: `Primary Target: ${topRole.label}`,
        desc: `${topRole.percentage}% of all scraped leads belong to this category (${topRole.count} contacts).`,
      });
    }

    if (quotaUsage.apify.percentage >= 80 || quotaUsage.hunter.percentage >= 80) {
      insights.push({
        type: "warning",
        title: "Approaching API Rate Limits",
        desc: "One or more provider API call counters are near their configured quota thresholds.",
      });
    }

    return NextResponse.json({
      range,
      startDate: start.toISOString(),
      endDate: now.toISOString(),
      kpi: {
        companies: periodCompanies,
        contacts: periodEmployees,
        emailsFound: periodEmailFound,
        emailsSent: periodSent,
        totalDrafts: periodDrafts,
        replied: periodReplied,
        draftSuccessRate,
        emailFindRate,
        replyRate,
      },
      growth: {
        companies: calculateGrowth(periodCompanies, prevCompanies),
        contacts: calculateGrowth(periodEmployees, prevEmployees),
        emailsFound: calculateGrowth(periodEmailFound, prevEmailFound),
        emailsSent: calculateGrowth(periodSent, prevSent),
        totalDrafts: calculateGrowth(periodDrafts, prevDrafts),
        replied: calculateGrowth(periodReplied, prevReplied),
      },
      allTimeKpi: {
        companies: allTimeCompanies,
        contacts: allTimeEmployees,
        emailsFound: allTimeEmailFound,
        emailsSent: allTimeSent,
        totalDrafts: allTimeDrafts,
        replied: allTimeReplied,
        emailFindRate:
          allTimeEmailLookups > 0
            ? Math.round((allTimeEmailFound / allTimeEmailLookups) * 100)
            : 0,
        draftSuccessRate:
          allTimeDrafts > 0 ? Math.round((allTimeSent / allTimeDrafts) * 100) : 0,
        replyRate:
          allTimeSent > 0 ? Math.round((allTimeReplied / allTimeSent) * 100) : 0,
      },
      timeSeries: buckets,
      funnel: funnelSteps,
      roleDistribution,
      statusDistribution,
      quotaUsage,
      recentRuns: recentRuns.map((r) => ({
        id: r.id,
        companyName: r.company.name ?? "Unknown",
        companyId: r.companyId,
        stage: r.stage,
        progress: r.progress,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
        errorMessage: r.errorMessage,
      })),
      topCompanies: topCompanies.map((c) => ({
        id: c.id,
        name: c.name,
        industry: c.industry,
        location: c.location,
        contactCount: c._count.employees,
      })),
      recentSent: recentSent.map((d) => ({
        id: d.id,
        subject: d.subject,
        sentAt: d.updatedAt.toISOString(),
        name: `${d.employee.firstName} ${d.employee.lastName}`,
        title: d.employee.currentTitle,
        companyName: d.employee.company.name,
        companyId: d.employee.company.id,
        status: d.status,
      })),
      apiUsage: usageByProvider,
      insights,
    });
  } catch (err: unknown) {
    console.error("[Dashboard API]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load dashboard analytics" },
      { status: 500 }
    );
  }
}
