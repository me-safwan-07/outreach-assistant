"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  Mail,
  Send,
  MessageSquareReply,
  TrendingUp,
  Activity,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  RefreshCw,
  Zap,
  ArrowRight,
  Layers,
  Search,
  Filter,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import {
  DashboardHeader,
  TimeFilterRange,
} from "@/components/dashboard/DashboardHeader";
import { KpiCards, KpiData, GrowthData } from "@/components/dashboard/KpiCards";
import {
  TimeSeriesChart,
  TimeSeriesPoint,
} from "@/components/dashboard/TimeSeriesChart";
import {
  ConversionFunnelCard,
  FunnelStepItem,
} from "@/components/dashboard/ConversionFunnelCard";
import {
  RoleDistributionChart,
  RoleDistributionItem,
} from "@/components/dashboard/RoleDistributionChart";
import { ApiQuotaMonitor } from "@/components/dashboard/ApiQuotaMonitor";
import { InsightsCard, InsightItem } from "@/components/dashboard/InsightsCard";

// ── Types ──────────────────────────────────────────────────────────────
interface PipelineRun {
  id: string;
  companyName: string;
  companyId: string;
  stage: string;
  progress: number;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
}

interface TopCompany {
  id: string;
  name: string | null;
  industry: string | null;
  location: string | null;
  contactCount: number;
}

interface RecentSent {
  id: string;
  subject: string;
  sentAt: string;
  name: string;
  title: string | null;
  companyName: string | null;
  companyId: string;
  status: string;
}

interface DashboardData {
  range: TimeFilterRange;
  startDate: string;
  endDate: string;
  kpi: KpiData;
  growth: GrowthData;
  allTimeKpi: KpiData;
  timeSeries: TimeSeriesPoint[];
  funnel: FunnelStepItem[];
  roleDistribution: RoleDistributionItem[];
  statusDistribution: Array<{
    status: string;
    label: string;
    count: number;
    percentage: number;
  }>;
  quotaUsage: {
    apify: { used: number; limit: number; percentage: number };
    hunter: { used: number; limit: number; percentage: number };
    gemini: { used: number; limit: number; percentage: number };
  };
  recentRuns: PipelineRun[];
  topCompanies: TopCompany[];
  recentSent: RecentSent[];
  apiUsage: Record<string, { date: string; count: number }[]>;
  insights: InsightItem[];
}

const STAGE_BADGE: Record<string, string> = {
  DONE: "b-badge-success",
  FAILED: "b-badge-error",
  COMPANY: "b-badge-info",
  EMPLOYEES: "b-badge-info",
  SCORING: "b-badge-warning",
  EMAILS: "b-badge-info",
  DRAFTS: "b-badge-info",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

function elapsedSec(start: string, end: string | null): string {
  const s = Math.round(
    ((end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime()) /
      1000
  );
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function Skel({ h = 32 }: { h?: number }) {
  return <div className="b-shimmer rounded" style={{ height: h }} />;
}

export default function DashboardPage() {
  const [range, setRange] = useState<TimeFilterRange>("weekly");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(60);

  // Search & Filter state for lists
  const [pipelineSearch, setPipelineSearch] = useState("");
  const [pipelineStageFilter, setPipelineStageFilter] = useState<string>("ALL");
  const [sentSearch, setSentSearch] = useState("");
  const [sentStatusFilter, setSentStatusFilter] = useState<string>("ALL");

  const fetchData = useCallback(
    async (showLoadingSpinner = true) => {
      if (showLoadingSpinner) setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/dashboard?range=${range}`);
        if (!res.ok) throw new Error("Failed to load dashboard data");
        const json: DashboardData = await res.json();
        setData(json);
        setLastRefresh(new Date());
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    },
    [range]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle auto-refresh interval
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const interval = setInterval(() => {
      fetchData(false);
    }, autoRefreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshInterval, fetchData]);

  // Filter pipeline runs
  const filteredRuns = useMemo(() => {
    if (!data) return [];
    return data.recentRuns.filter((r) => {
      const matchSearch =
        !pipelineSearch ||
        r.companyName.toLowerCase().includes(pipelineSearch.toLowerCase());
      const matchStage =
        pipelineStageFilter === "ALL" ||
        (pipelineStageFilter === "ACTIVE"
          ? r.stage !== "DONE" && r.stage !== "FAILED"
          : r.stage === pipelineStageFilter);
      return matchSearch && matchStage;
    });
  }, [data, pipelineSearch, pipelineStageFilter]);

  // Filter sent emails
  const filteredSent = useMemo(() => {
    if (!data) return [];
    return data.recentSent.filter((s) => {
      const query = sentSearch.toLowerCase();
      const matchSearch =
        !query ||
        s.name.toLowerCase().includes(query) ||
        (s.companyName && s.companyName.toLowerCase().includes(query)) ||
        s.subject.toLowerCase().includes(query);
      const matchStatus =
        sentStatusFilter === "ALL" || s.status === sentStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [data, sentSearch, sentStatusFilter]);

  // Export CSV
  const handleExportCsv = useCallback(() => {
    if (!data) return;
    try {
      const headers = [
        "Timestamp",
        "Label",
        "Full Date",
        "Contacts Added",
        "Verified Emails Found",
        "Drafts Generated",
        "Outreach Sent",
        "Replies Received",
        "Total Activity Volume",
      ];
      const rows = data.timeSeries.map((t) => [
        `"${t.timestamp}"`,
        `"${t.label}"`,
        `"${t.fullDate}"`,
        t.contacts,
        t.emailsFound,
        t.drafts,
        t.sent,
        t.replied,
        t.totalActivity,
      ]);

      const csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `outreach_analytics_${range}_${new Date().toISOString().split("T")[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Analytics data exported to CSV");
    } catch {
      toast.error("Failed to export analytics report");
    }
  }, [data, range]);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* ── 1. Header with Time Range Filters & Controls ── */}
      <DashboardHeader
        range={range}
        onRangeChange={(newRange) => {
          setRange(newRange);
          toast.info(`Switched filter to ${newRange.toUpperCase()}`);
        }}
        loading={loading}
        onRefresh={() => fetchData(true)}
        lastRefresh={lastRefresh}
        autoRefreshInterval={autoRefreshInterval}
        onAutoRefreshChange={setAutoRefreshInterval}
        onExportCsv={handleExportCsv}
      />

      {/* Error state */}
      {error && (
        <div
          className="b-card p-4 text-xs flex items-center justify-between"
          style={{
            borderColor: "rgba(248,113,113,0.3)",
            color: "var(--error)",
            background: "rgba(248,113,113,0.05)",
          }}
        >
          <span>Error loading analytics: {error}</span>
          <button
            onClick={() => fetchData(true)}
            className="b-btn b-btn-outline text-xs px-2.5 py-1"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── 2. Smart Telemetry & AI Insights Banner ── */}
      {data && data.insights.length > 0 && (
        <InsightsCard insights={data.insights} />
      )}

      {/* ── 3. High-Impact KPI Cards with Trends & Sparklines ── */}
      {loading && !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skel key={i} h={88} />
          ))}
        </div>
      ) : data ? (
        <KpiCards
          kpi={data.kpi}
          growth={data.growth}
          allTime={data.allTimeKpi}
          range={range}
          sparklineData={data.timeSeries}
        />
      ) : null}

      {/* ── 4. Main Activity Timeline Chart (Curved Area & Bar with Tooltips) ── */}
      {loading && !data ? (
        <div className="b-card p-5">
          <Skel h={280} />
        </div>
      ) : data ? (
        <TimeSeriesChart data={data.timeSeries} range={range} />
      ) : null}

      {/* ── 5. Middle Grid: Funnel + Role Distribution ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading && !data ? (
          <>
            <div className="b-card p-5">
              <Skel h={240} />
            </div>
            <div className="b-card p-5">
              <Skel h={240} />
            </div>
          </>
        ) : data ? (
          <>
            {/* Outreach Conversion Funnel */}
            <ConversionFunnelCard steps={data.funnel} range={range} />

            {/* Audience & Role Category Distribution */}
            <RoleDistributionChart data={data.roleDistribution} />
          </>
        ) : null}
      </div>

      {/* ── 6. API Quota & Usage Monitor ── */}
      {loading && !data ? (
        <div className="b-card p-5">
          <Skel h={180} />
        </div>
      ) : data ? (
        <ApiQuotaMonitor quota={data.quotaUsage} apiUsage={data.apiUsage} />
      ) : null}

      {/* ── 7. Bottom Grid: Pipeline Runs + Top Companies + Recent Sent ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Runs with Search & Stage Filter */}
        <div className="b-card p-5 lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <div className="b-section-title flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Pipeline Runs
            </div>
            <span
              className="b-mono"
              style={{ fontSize: "11px", color: "var(--text-subtle)" }}
            >
              {filteredRuns.length} runs
            </span>
          </div>

          {/* Quick Filter & Search Bar */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2.5 top-2.5 text-[var(--text-subtle)]" />
              <input
                type="text"
                value={pipelineSearch}
                onChange={(e) => setPipelineSearch(e.target.value)}
                placeholder="Search company..."
                className="b-input pl-8 py-1 text-xs"
              />
            </div>
            <div className="flex items-center gap-1">
              {["ALL", "ACTIVE", "DONE", "FAILED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setPipelineStageFilter(st)}
                  className="px-2 py-0.5 text-[10px] b-mono rounded cursor-pointer transition-colors"
                  style={{
                    background:
                      pipelineStageFilter === st ? "var(--bg-3)" : "var(--bg-2)",
                    color:
                      pipelineStageFilter === st
                        ? "var(--text)"
                        : "var(--text-subtle)",
                    border: `1px solid ${
                      pipelineStageFilter === st
                        ? "var(--border-focus)"
                        : "var(--border)"
                    }`,
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Runs list */}
          <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
            {loading && !data ? (
              Array.from({ length: 4 }).map((_, i) => <Skel key={i} h={52} />)
            ) : filteredRuns.length === 0 ? (
              <div
                className="text-center py-8 b-mono text-xs"
                style={{ color: "var(--text-subtle)" }}
              >
                No pipeline runs found
              </div>
            ) : (
              filteredRuns.map((run) => {
                const isActive = run.stage !== "DONE" && run.stage !== "FAILED";
                return (
                  <Link
                    key={run.id}
                    href={`/companies/${run.companyId}`}
                    className="flex items-center gap-3 p-2.5 rounded group transition-colors block"
                    style={{
                      textDecoration: "none",
                      borderRadius: "var(--radius-sm)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--bg-2)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <div className="flex-shrink-0">
                      {isActive ? (
                        <Loader2
                          className="w-3.5 h-3.5 animate-spin"
                          style={{ color: "var(--text-muted)" }}
                        />
                      ) : run.stage === "DONE" ? (
                        <CheckCircle2
                          className="w-3.5 h-3.5"
                          style={{ color: "var(--success)" }}
                        />
                      ) : (
                        <XCircle
                          className="w-3.5 h-3.5"
                          style={{ color: "var(--error)" }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-medium truncate"
                          style={{ color: "var(--text)" }}
                        >
                          {run.companyName}
                        </span>
                        <span
                          className={`b-badge text-[10px] ${
                            STAGE_BADGE[run.stage] ?? ""
                          }`}
                        >
                          {run.stage}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] b-mono text-[var(--text-subtle)]">
                        <span>{timeAgo(run.startedAt)}</span>
                        {run.finishedAt && (
                          <span>
                            · {elapsedSec(run.startedAt, run.finishedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight
                      className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "var(--text-muted)" }}
                    />
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Top Companies */}
        <div className="b-card p-5 lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <div className="b-section-title flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5" />
              Top Companies
            </div>
            <Link
              href="/"
              className="b-mono text-[11px] flex items-center gap-1 hover:text-white transition-colors"
              style={{ color: "var(--text-subtle)", textDecoration: "none" }}
            >
              <span>View all</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </Link>
          </div>

          <div className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
            {loading && !data ? (
              Array.from({ length: 5 }).map((_, i) => <Skel key={i} h={48} />)
            ) : data && data.topCompanies.length === 0 ? (
              <div
                className="text-center py-8 b-mono text-xs"
                style={{ color: "var(--text-subtle)" }}
              >
                No companies analyzed yet
              </div>
            ) : data ? (
              data.topCompanies.map((c, i) => (
                <Link
                  key={c.id}
                  href={`/companies/${c.id}`}
                  className="flex items-center gap-3 p-2.5 rounded group transition-colors block"
                  style={{
                    textDecoration: "none",
                    borderRadius: "var(--radius-sm)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg-2)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <span
                    className="b-mono w-4 text-right flex-shrink-0 text-xs"
                    style={{ color: "var(--text-subtle)" }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-xs font-medium truncate"
                      style={{ color: "var(--text)" }}
                    >
                      {c.name ?? "Unknown"}
                    </div>
                    <div
                      className="b-mono truncate text-[10px]"
                      style={{ color: "var(--text-subtle)" }}
                    >
                      {c.industry ?? "—"}
                      {c.location ? ` · ${c.location}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 text-xs">
                    <Users
                      className="w-3 h-3"
                      style={{ color: "var(--text-subtle)" }}
                    />
                    <span className="b-mono">{c.contactCount}</span>
                  </div>
                </Link>
              ))
            ) : null}
          </div>
        </div>

        {/* Recently Sent Outreach */}
        <div className="b-card p-5 lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <div className="b-section-title flex items-center gap-2">
              <Send className="w-3.5 h-3.5" />
              Sent Outreach
            </div>
            <span
              className="b-mono"
              style={{ fontSize: "11px", color: "var(--text-subtle)" }}
            >
              {filteredSent.length} records
            </span>
          </div>

          {/* Quick Filter & Search */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2.5 top-2.5 text-[var(--text-subtle)]" />
              <input
                type="text"
                value={sentSearch}
                onChange={(e) => setSentSearch(e.target.value)}
                placeholder="Search contact or subject..."
                className="b-input pl-8 py-1 text-xs"
              />
            </div>
            <div className="flex items-center gap-1">
              {["ALL", "SENT", "REPLIED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setSentStatusFilter(st)}
                  className="px-2 py-0.5 text-[10px] b-mono rounded cursor-pointer transition-colors"
                  style={{
                    background:
                      sentStatusFilter === st ? "var(--bg-3)" : "var(--bg-2)",
                    color:
                      sentStatusFilter === st
                        ? "var(--text)"
                        : "var(--text-subtle)",
                    border: `1px solid ${
                      sentStatusFilter === st
                        ? "var(--border-focus)"
                        : "var(--border)"
                    }`,
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
            {loading && !data ? (
              Array.from({ length: 4 }).map((_, i) => <Skel key={i} h={52} />)
            ) : filteredSent.length === 0 ? (
              <div
                className="text-center py-8 b-mono text-xs"
                style={{ color: "var(--text-subtle)" }}
              >
                No sent outreach found
              </div>
            ) : (
              filteredSent.map((s) => (
                <Link
                  key={s.id}
                  href={`/companies/${s.companyId}`}
                  className="block p-2.5 rounded group transition-colors"
                  style={{
                    textDecoration: "none",
                    borderRadius: "var(--radius-sm)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg-2)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-xs font-medium truncate"
                        style={{ color: "var(--text)" }}
                      >
                        {s.subject}
                      </div>
                      <div
                        className="b-mono truncate mt-0.5 text-[10px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {s.name}
                        {s.title ? ` · ${s.title}` : ""}
                      </div>
                      <div
                        className="b-mono truncate text-[10px]"
                        style={{ color: "var(--text-subtle)" }}
                      >
                        {s.companyName}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                      {s.status === "REPLIED" ? (
                        <span
                          className="b-badge text-[10px]"
                          style={{
                            color: "var(--success)",
                            borderColor: "rgba(74,222,128,0.3)",
                            background: "rgba(74,222,128,0.1)",
                          }}
                        >
                          Replied
                        </span>
                      ) : (
                        <CheckCircle2
                          className="w-3 h-3"
                          style={{ color: "var(--success)" }}
                        />
                      )}
                      <span
                        className="b-mono text-[10px]"
                        style={{ color: "var(--text-subtle)" }}
                      >
                        {timeAgo(s.sentAt)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
