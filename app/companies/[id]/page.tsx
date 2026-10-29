"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Users,
  Mail,
  Sparkles,
  ExternalLink,
  ChevronLeft,
  RefreshCw,
  Download,
  Copy,
  Check,
  Send,
  Search,
  ShieldCheck,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Briefcase,
  Globe,
  MapPin,
  Pencil,
  X,
  Zap,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import EmailDrawer from "@/components/EmailDrawer";
import BulkSendModal from "@/components/BulkSendModal";
import { toast } from "sonner";

interface EmailLookup {
  id: string;
  email: string | null;
  status: "FOUND" | "NOT_FOUND" | "GUESSED_UNVERIFIED" | "ERROR";
  confidence: number | null;
  source: string | null;
}

interface EmailDraft {
  id: string;
  subject: string;
  body: string;
  model: string;
  status: "DRAFT" | "COPIED" | "SENT" | "REPLIED";
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  headline: string | null;
  currentTitle: string | null;
  location: string | null;
  linkedinUrl: string;
  roleCategory: string;
  relevanceScore: number;
  scoreReason: string | null;
  hiring: boolean | null;
  openToWork: boolean | null;
  emailLookups: EmailLookup[];
  emailDrafts: EmailDraft[];
}

interface PipelineRun {
  id: string;
  stage: string;
  progress: number;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
}

interface CompanyDetail {
  id: string;
  linkedinUrl: string;
  name: string | null;
  website: string | null;
  domain: string | null;
  industry: string | null;
  size: string | null;
  description: string | null;
  location: string | null;
  pipelineRuns: PipelineRun[];
  employees: Employee[];
}

const STAGES = [
  { id: "COMPANY", label: "Company Info", desc: "Metadata & count" },
  { id: "EMPLOYEES", label: "Team Extraction", desc: "Active members" },
  { id: "SCORING", label: "Relevance Rank", desc: "Decision-maker scoring" },
  { id: "EMAILS", label: "Email Finder", desc: "Verified work emails" },
  { id: "DRAFTS", label: "AI Pitches", desc: "Gemini tailored copy" },
];

const ROLE_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  HR_RECRUITER: { label: "Recruiter / Talent", badgeClass: "b-badge b-badge-success" },
  FOUNDER_EXEC: { label: "Founder / Exec", badgeClass: "b-badge b-badge-info" },
  ENGINEERING_LEAD: { label: "Engineering Lead", badgeClass: "b-badge b-badge-info" },
  SOFTWARE_ENGINEER: { label: "Software Engineer", badgeClass: "b-badge" },
  OTHER: { label: "Team Member", badgeClass: "b-badge" },
};

export default function CompanyPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const companyId = params.id as string;
  const runId = searchParams.get("run");

  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [sendingDraftId, setSendingDraftId] = useState<string | null>(null);
  const [editingEmpEmailId, setEditingEmpEmailId] = useState<string | null>(null);
  const [tempEmpEmail, setTempEmpEmail] = useState("");
  const [savingEmpEmail, setSavingEmpEmail] = useState(false);
  const [pollingRunId, setPollingRunId] = useState<string | null>(runId);
  const [runStatus, setRunStatus] = useState<PipelineRun | null>(null);
  const [quickCopied, setQuickCopied] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "EMAILS" | "HIGH_SCORE" | "HIRING">("ALL");
  const [bulkSendOpen, setBulkSendOpen] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCompany = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}`);
      if (res.ok) setCompany(await res.json());
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Adaptive polling
  useEffect(() => {
    if (!pollingRunId) return;

    let interval = 2000;

    const poll = async () => {
      try {
        const res = await fetch(`/api/pipeline/${pollingRunId}/status`);
        if (!res.ok) return;
        const status: PipelineRun = await res.json();
        setRunStatus(status);

        const newInterval = status.progress >= 75 ? 4000 : 2000;
        if (newInterval !== interval) {
          interval = newInterval;
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = setInterval(poll, interval);
        }

        if (status.stage === "DONE" || status.stage === "FAILED") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setPollingRunId(null);
          fetchCompany();
          if (status.stage === "DONE") {
            toast.success("Intelligence pipeline completed!", {
              description: "All contacts discovered, scored, and email pitches drafted.",
            });
          }
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    };

    poll();
    pollIntervalRef.current = setInterval(poll, interval);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [pollingRunId, fetchCompany]);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  // Auto-resume polling if active run is in flight
  useEffect(() => {
    if (!pollingRunId && company?.pipelineRuns?.[0]) {
      const latest = company.pipelineRuns[0];
      if (latest.stage !== "DONE" && latest.stage !== "FAILED") {
        setPollingRunId(latest.id);
      }
    }
  }, [company, pollingRunId]);

  const activeRun = runStatus ?? company?.pipelineRuns?.[0] ?? null;
  const isDone = activeRun?.stage === "DONE";
  const isFailed = activeRun?.stage === "FAILED";
  const isRunning = !isDone && !isFailed && !!activeRun;

  async function quickCopy(emp: Employee) {
    const draft = emp.emailDrafts[0];
    if (!draft) return;
    const text = emp.linkedinUrl;
    await navigator.clipboard.writeText(text);
    setQuickCopied(emp.id);
    setTimeout(() => setQuickCopied(null), 2000);
    toast.success(`Copied email pitch for ${emp.firstName}!`, {
      description: "Subject and body ready to paste.",
    });

    // await fetch(`/api/drafts/${draft.id}`, {
    //   method: "PATCH",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ status: "COPIED" }),
    // });
    // fetchCompany();
  }

  async function handleQuickSend(emp: Employee) {
    const draft = emp.emailDrafts[0];
    if (!draft) return;
    setSendingDraftId(draft.id);
    try {
      const res = await fetch(`/api/drafts/${draft.id}/send`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Email sent directly to ${emp.firstName}!`, {
          description: "Delivered with SAFWAN-RESUME.pdf attached.",
        });
        fetchCompany();
      } else {
        toast.error(data.error || "Could not dispatch email directly", {
          description: "Opening pitch drawer for manual options or SMTP setup...",
        });
        setSelectedDraftId(draft.id);
      }
    } catch {
      toast.error("Network error while sending email");
    } finally {
      setSendingDraftId(null);
    }
  }

  async function saveEmpEmail(empId: string) {
    const trimmed = tempEmpEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    setSavingEmpEmail(true);
    try {
      const res = await fetch(`/api/employees/${empId}/email`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Recruiter email updated successfully!");
        setEditingEmpEmailId(null);
        fetchCompany();
      } else {
        toast.error(data.error || "Failed to update email");
      }
    } catch {
      toast.error("Network error while updating email");
    } finally {
      setSavingEmpEmail(false);
    }
  }

  function quickMailto(emp: Employee) {
    const draft = emp.emailDrafts[0];
    const lookup = emp.emailLookups[0];
    if (!draft) return;
    const email = lookup?.status === "FOUND" ? (lookup.email ?? "") : "";
    const uri = `mailto:${email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
    window.location.href = uri;
    toast.info("Opening mail client...");
  }

  function exportCsv() {
    if (!company) return;
    const rows = [
      ["Name", "Title", "Role", "Score", "Email", "Subject", "Body"],
      ...company.employees.map((emp) => {
        const lookup = emp.emailLookups[0];
        const draft = emp.emailDrafts[0];
        return [
          `${emp.firstName} ${emp.lastName}`,
          emp.currentTitle ?? emp.headline ?? "",
          emp.roleCategory,
          String(emp.relevanceScore),
          lookup?.email ?? "",
          draft?.subject ?? "",
          (draft?.body ?? "").replace(/\n/g, " "),
        ];
      }),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${company.name ? company.name.toLowerCase().replace(/\s+/g, "-") : "company"}-outreach.csv`;
    a.click();
    toast.success("Exported outreach list to CSV!");
  }

  const filteredEmployees = useMemo(() => {
    if (!company?.employees) return [];
    return company.employees.filter((emp) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(q) ||
        (emp.currentTitle && emp.currentTitle.toLowerCase().includes(q)) ||
        (emp.headline && emp.headline.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (activeFilter === "EMAILS") {
        return emp.emailLookups.some((l) => l.status === "FOUND");
      }
      if (activeFilter === "HIGH_SCORE") {
        return emp.relevanceScore >= 75;
      }
      if (activeFilter === "HIRING") {
        return emp.hiring === true;
      }
      return true;
    });
  }, [company?.employees, searchQuery, activeFilter]);

  const stats = useMemo(() => {
    if (!company?.employees) return { total: 0, verified: 0, drafts: 0, avgScore: 0 };
    const total = company.employees.length;
    const verified = company.employees.filter((e) =>
      e.emailLookups.some((l) => l.status === "FOUND")
    ).length;
    const drafts = company.employees.filter((e) => e.emailDrafts.length > 0).length;
    const avgScore = total
      ? Math.round(company.employees.reduce((acc, e) => acc + e.relevanceScore, 0) / total)
      : 0;
    return { total, verified, drafts, avgScore };
  }, [company?.employees]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="b-shimmer h-8 w-40" />
        <div className="b-shimmer h-36" />
        <div className="grid grid-cols-4 gap-px" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="b-shimmer h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="b-card p-12 text-center max-w-lg mx-auto">
        <div className="w-10 h-10 rounded border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-3" style={{ background: "rgba(248,113,113,0.08)" }}>
          <AlertTriangle className="w-5 h-5" />
        </div>
        <h2 className="text-base font-semibold text-[var(--text)] mb-1">Company Not Found</h2>
        <p className="text-xs text-[var(--text-muted)] mb-5">
          The requested company profile does not exist or may have been removed.
        </p>
        <Link href="/" className="b-btn b-btn-primary">
          <ChevronLeft className="w-3.5 h-3.5 mr-1" />
          Back to Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/"
          className="b-mono inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>All Companies</span>
        </Link>

        <div className="flex items-center gap-2">
          {company.employees.some((e) => e.emailDrafts.length > 0) && (
            <>
              <button
                onClick={exportCsv}
                className="b-btn b-btn-outline"
                style={{ padding: "6px 12px", fontSize: "12px" }}
                title="Download decision-makers and drafts as CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                id="bulk-send-button"
                onClick={() => setBulkSendOpen(true)}
                className="b-btn b-btn-primary"
                style={{ padding: "6px 12px", fontSize: "12px" }}
                title="Send emails in batch"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Bulk Send</span>
              </button>
            </>
          )}

          <button
            onClick={() => {
              setLoading(true);
              fetchCompany();
              toast.info("Refreshed data");
            }}
            className="b-btn b-btn-outline"
            style={{ padding: "6px 12px", fontSize: "12px" }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button
            disabled={isRunning}
            onClick={async () => {
              toast.info("Restarting intelligence pipeline...");
              const res = await fetch("/api/pipeline/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  linkedinUrl: company.linkedinUrl,
                  refresh: true,
                }),
              });
              const data = await res.json();
              if (data.pipelineRunId) {
                setPollingRunId(data.pipelineRunId);
                setRunStatus(null);
                fetchCompany();
              }
            }}
            className="b-btn b-btn-outline"
            style={{ padding: "6px 12px", fontSize: "12px" }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Re-run Pipeline</span>
          </button>
        </div>
      </div>

      {/* Main Company Header Card */}
      <div className="b-card p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded flex items-center justify-center font-bold text-xl flex-shrink-0"
              style={{
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              {(company.name ?? "?")[0].toUpperCase()}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--text)] tracking-tight">
                  {company.name ?? "Analyzing Company..."}
                </h1>
                {isDone && (
                  <span className="b-badge b-badge-success">
                    <CheckCircle2 className="w-3 h-3" />
                    Enriched
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                {company.industry && (
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
                    {company.industry}
                  </span>
                )}
                {company.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
                    {company.location}
                  </span>
                )}
                {company.size && (
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
                    {company.size} employees
                  </span>
                )}
                {company.website && (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[var(--text)] hover:underline"
                  >
                    <Globe className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
                    <span>Website</span>
                  </a>
                )}
                <a
                  href={company.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[var(--text)] hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
                  <span>LinkedIn</span>
                </a>
              </div>

              {company.description && (
                <p className="text-xs text-[var(--text-muted)] line-clamp-2 max-w-3xl leading-relaxed pt-1">
                  {company.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live Pipeline Stepper Banner */}
      {activeRun && (
        <div className="b-card p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {isRunning && <span className="b-dot b-dot-warning b-pulse" />}
              {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {isFailed && <AlertTriangle className="w-4 h-4 text-rose-400" />}
              <span className="font-semibold text-xs text-[var(--text)]">
                {isDone
                  ? "Pipeline Complete — Ready for Outreach"
                  : isFailed
                  ? "Pipeline Interrupted"
                  : "Automated Intelligence Pipeline Active"}
              </span>
            </div>
            <span className="b-mono text-xs">
              {activeRun.progress}% Finished
            </span>
          </div>

          {/* Stepper Visual Nodes */}
          <div
            className="grid grid-cols-2 sm:grid-cols-5 gap-px"
            style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}
          >
            {STAGES.map((s, idx) => {
              const currentIdx = STAGES.findIndex((x) => x.id === activeRun.stage);
              const isPassed = isDone || idx < currentIdx;
              const isCurrent = isRunning && s.id === activeRun.stage;

              return (
                <div
                  key={s.id}
                  className="p-2.5 text-xs transition-colors"
                  style={{
                    background: isCurrent ? "var(--bg-2)" : "var(--bg-1)",
                    borderRight: idx < 4 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="b-mono text-[10px]">0{idx + 1}</span>
                    {isPassed && <Check className="w-3 h-3 text-emerald-400" />}
                  </div>
                  <div
                    className="font-medium truncate mb-2"
                    style={{ color: isPassed ? "var(--text)" : isCurrent ? "var(--text)" : "var(--text-subtle)" }}
                  >
                    {s.label}
                  </div>
                  <div className="b-progress">
                    <div
                      className="b-progress-bar"
                      style={{
                        width: isPassed ? "100%" : isCurrent ? "65%" : "0%",
                        background: isPassed ? "var(--success)" : "var(--text)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {isFailed && activeRun.errorMessage && (
            <div
              className="p-3 text-xs border border-rose-500/30 text-rose-300 flex items-center justify-between"
              style={{ background: "rgba(248,113,113,0.06)", borderRadius: "var(--radius-sm)" }}
            >
              <span>{activeRun.errorMessage}</span>
              <button
                onClick={async () => {
                  const res = await fetch("/api/pipeline/start", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ linkedinUrl: company.linkedinUrl }),
                  });
                  const data = await res.json();
                  if (data.pipelineRunId) setPollingRunId(data.pipelineRunId);
                }}
                className="b-btn b-btn-primary"
                style={{ padding: "4px 10px", fontSize: "11px" }}
              >
                Retry Pipeline
              </button>
            </div>
          )}
        </div>
      )}

      {/* KPI Stats Row */}
      <section
        className="grid grid-cols-2 lg:grid-cols-4 gap-px"
        style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}
      >
        {[
          { label: "Decision-Makers", value: stats.total, sub: "Scored contacts", icon: Users },
          { label: "Verified Inboxes", value: stats.verified, sub: "Zero bounce rate", icon: ShieldCheck },
          { label: "AI Pitches Ready", value: stats.drafts, sub: "Gemini tailored", icon: Mail },
          { label: "Avg Match Score", value: `${stats.avgScore}%`, sub: "Fit relevance", icon: Flame },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              className="p-4"
              style={{
                background: "var(--bg-1)",
                borderRight: i < 3 ? "1px solid var(--border)" : "none",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="b-section-title" style={{ fontSize: "10px" }}>{item.label}</span>
                <Icon className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
              </div>
              <div className="b-stat" style={{ fontSize: "22px" }}>{item.value}</div>
              <div className="b-mono text-[10px] mt-0.5">{item.sub}</div>
            </div>
          );
        })}
      </section>

      {/* Contacts Hub */}
      <div className="b-card overflow-hidden">
        {/* Hub Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--border)] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[var(--text)]">Key Decision-Makers & Outreaches</h2>
              <span className="b-mono b-badge">
                {filteredEmployees.length} of {company.employees.length}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Review hyper-personalized pitches, dispatch directly, or copy to clipboard
            </p>
          </div>

          {/* Filter Pills & Search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-subtle)] pointer-events-none" />
              <input
                placeholder="Search name or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="b-input b-mono text-xs w-48"
                style={{ paddingLeft: "26px", height: "30px" }}
              />
            </div>

            <div
              className="flex items-center gap-0.5 p-0.5 rounded border border-[var(--border)]"
              style={{ background: "var(--bg)", borderRadius: "var(--radius-sm)" }}
            >
              {(
                [
                  { id: "ALL", label: "All" },
                  { id: "EMAILS", label: "Verified Only" },
                  { id: "HIGH_SCORE", label: "Score ≥ 75" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFilter(f.id)}
                  className="b-mono px-2 py-1 text-[11px] rounded transition-colors"
                  style={{
                    background: activeFilter === f.id ? "var(--bg-2)" : "transparent",
                    color: activeFilter === f.id ? "var(--text)" : "var(--text-muted)",
                    border: activeFilter === f.id ? "1px solid var(--border)" : "1px solid transparent",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Contacts Table */}
        {filteredEmployees.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="w-8 h-8 text-[var(--text-subtle)] mx-auto mb-2" />
            <div className="text-xs font-semibold text-[var(--text)]">
              {isRunning ? "Pipeline running: evaluating team profiles..." : "No contacts match your filter"}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
              {isRunning
                ? "Discovered profiles are currently being enriched and scored."
                : "Reset your search keyword or toggle to the 'All' tab."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] b-section-title" style={{ background: "var(--bg)" }}>
                  <th className="py-3 px-4">Decision-Maker</th>
                  <th className="py-3 px-3">Role & Title</th>
                  <th className="py-3 px-3">Relevance</th>
                  <th className="py-3 px-3">Work Email</th>
                  <th className="py-3 px-3">Pitch Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredEmployees.map((emp) => {
                  const lookup = emp.emailLookups[0];
                  const draft = emp.emailDrafts[0];
                  const role = ROLE_CONFIG[emp.roleCategory] ?? ROLE_CONFIG.OTHER;

                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-[var(--bg-2)] transition-colors group"
                      style={{ background: "var(--bg-1)" }}
                    >
                      {/* Name & LinkedIn */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded flex items-center justify-center font-semibold text-[11px] flex-shrink-0"
                            style={{
                              background: "var(--bg-2)",
                              border: "1px solid var(--border)",
                              color: "var(--text)",
                              borderRadius: "var(--radius-sm)",
                            }}
                          >
                            {emp.firstName[0]}
                            {emp.lastName[0] || ""}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <a
                                href={emp.linkedinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-xs text-[var(--text)] hover:underline flex items-center gap-1"
                              >
                                <span>{emp.firstName} {emp.lastName}</span>
                                <ExternalLink className="w-3 h-3 text-[var(--text-subtle)]" />
                              </a>
                              {emp.hiring && (
                                <span className="b-badge b-badge-success text-[10px] py-0 px-1.5">
                                  Hiring
                                </span>
                              )}
                            </div>
                            {emp.location && (
                              <p className="text-[11px] text-[var(--text-muted)] truncate max-w-[160px]">
                                {emp.location}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Title & Role */}
                      <td className="py-3 px-3">
                        <p className="font-medium text-[var(--text)] text-xs truncate max-w-[190px]">
                          {emp.currentTitle ?? emp.headline ?? "—"}
                        </p>
                        <span className={`${role.badgeClass} mt-1 text-[10px]`}>
                          {role.label}
                        </span>
                      </td>

                      {/* Match Score */}
                      <td className="py-3 px-3 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <span className="b-mono font-bold text-xs text-[var(--text)] w-6">
                            {emp.relevanceScore}
                          </span>
                          <div className="b-progress flex-1 max-w-[60px]">
                            <div
                              className="b-progress-bar"
                              style={{
                                width: `${emp.relevanceScore}%`,
                                background: emp.relevanceScore >= 80 ? "var(--success)" : "var(--text)",
                              }}
                            />
                          </div>
                        </div>
                        {emp.scoreReason && (
                          <p
                            className="b-mono text-[10px] text-[var(--text-subtle)] truncate max-w-[120px] mt-0.5"
                            title={emp.scoreReason}
                          >
                            {emp.scoreReason}
                          </p>
                        )}
                      </td>

                      {/* Work Email */}
                      <td className="py-3 px-3 min-w-[180px]">
                        {editingEmpEmailId === emp.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="email"
                              value={tempEmpEmail}
                              onChange={(e) => setTempEmpEmail(e.target.value)}
                              placeholder="lead@company.com"
                              className="b-input b-mono text-xs w-36"
                              style={{ height: "26px", padding: "2px 6px" }}
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="default"
                              isLoading={savingEmpEmail}
                              onClick={() => saveEmpEmail(emp.id)}
                              className="h-6 text-[10px] px-2"
                            >
                              Save
                            </Button>
                            <button
                              type="button"
                              onClick={() => setEditingEmpEmailId(null)}
                              className="p-1 text-[var(--text-muted)] hover:text-[var(--text)]"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {lookup?.status === "FOUND" ? (
                              <div className="flex items-center gap-1.5">
                                <span className="b-mono text-[11px] text-[var(--text)] truncate max-w-[140px]">
                                  {lookup.email}
                                </span>
                                <span className="b-badge b-badge-success text-[9px] py-0 px-1">
                                  ✓
                                </span>
                              </div>
                            ) : lookup?.status === "GUESSED_UNVERIFIED" ? (
                              <div className="space-y-0.5">
                                <span className="b-mono text-[11px] text-amber-300 truncate max-w-[140px] block">
                                  {lookup.email}
                                </span>
                                <span className="b-badge b-badge-warning text-[9px] py-0 px-1">
                                  Guess
                                </span>
                              </div>
                            ) : (
                              <span className="b-mono text-[11px] text-[var(--text-subtle)] italic">
                                No email
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEmpEmailId(emp.id);
                                setTempEmpEmail(lookup?.email ?? "");
                              }}
                              className="p-1 text-[var(--text-subtle)] hover:text-[var(--text)] transition-colors opacity-70 group-hover:opacity-100"
                              title="Edit email address"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Pitch Status */}
                      <td className="py-3 px-3">
                        {draft ? (
                          <span
                            className={
                              draft.status === "SENT" || draft.status === "REPLIED"
                                ? "b-badge b-badge-success text-[10px]"
                                : draft.status === "COPIED"
                                ? "b-badge b-badge-warning text-[10px]"
                                : "b-badge text-[10px]"
                            }
                          >
                            {draft.status === "DRAFT" ? "Ready" : draft.status}
                          </span>
                        ) : (
                          <span className="text-[var(--text-subtle)] text-xs">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {draft ? (
                            <>
                              <button
                                onClick={() => handleQuickSend(emp)}
                                disabled={sendingDraftId === draft.id}
                                className="b-btn b-btn-primary"
                                style={{ padding: "4px 8px", fontSize: "11px" }}
                                title="1-click direct dispatch with resume attached"
                              >
                                <Rocket className="w-3 h-3" />
                                <span>{sendingDraftId === draft.id ? "Sending..." : "Send"}</span>
                              </button>

                              <button
                                onClick={() => setSelectedDraftId(draft.id)}
                                className="b-btn b-btn-outline"
                                style={{ padding: "4px 8px", fontSize: "11px" }}
                              >
                                Review
                              </button>

                              <button
                                onClick={() => quickCopy(emp)}
                                className="b-btn b-btn-ghost"
                                style={{ padding: "4px 6px" }}
                                title="Copy Subject & Pitch"
                              >
                                {quickCopied === emp.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <button
                                onClick={() => quickMailto(emp)}
                                className="b-btn b-btn-ghost"
                                style={{ padding: "4px 6px" }}
                                title="Open mail client"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="b-mono text-[10px] text-[var(--text-subtle)]">Drafting...</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over Email Drawer */}
      {selectedDraftId && (
        <EmailDrawer
          draftId={selectedDraftId}
          onClose={() => {
            setSelectedDraftId(null);
            fetchCompany();
          }}
        />
      )}

      {/* Bulk Send Modal */}
      {bulkSendOpen && company && (
        <BulkSendModal
          companyId={company.id}
          companyName={company.name ?? "This Company"}
          employees={company.employees}
          onClose={() => setBulkSendOpen(false)}
          onComplete={() => {
            setBulkSendOpen(false);
            fetchCompany();
          }}
        />
      )}
    </div>
  );
}
