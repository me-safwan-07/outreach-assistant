"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Users,
  Mail,
  Sparkles,
  ArrowRight,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Flame,
} from "lucide-react";
import { toast } from "sonner";

interface CompanyListItem {
  id: string;
  linkedinUrl: string;
  name: string | null;
  industry: string | null;
  location: string | null;
  createdAt: string;
  pipelineRuns: Array<{ stage: string; progress: number; startedAt: string }>;
  _count: { employees: number };
}

const SAMPLE_COMPANIES = [
  { name: "Stripe", url: "https://www.linkedin.com/company/stripe" },
  { name: "Linear", url: "https://www.linkedin.com/company/linear-app" },
  { name: "Vercel", url: "https://www.linkedin.com/company/vercel" },
  { name: "Supabase", url: "https://www.linkedin.com/company/supabase" },
];

const WORKFLOW_STEPS = [
  { step: "01", title: "Paste LinkedIn URL", desc: "Provide any target company profile." },
  { step: "02", title: "AI Finds Decision Makers", desc: "Scrapes employees and ranks by relevance." },
  { step: "03", title: "Find Work Emails", desc: "Multi-provider verified email discovery." },
  { step: "04", title: "Personalized AI Drafts", desc: "Gemini crafts custom 130-word pitches." },
];

function isValidLinkedInUrl(url: string) {
  return /^https?:\/\/(www\.)?linkedin\.com\/company\//i.test(url.trim());
}

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

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => { fetchCompanies(); }, []);

  async function fetchCompanies() {
    try {
      const res = await fetch("/api/companies");
      if (res.ok) setCompanies(await res.json());
    } finally {
      setLoadingList(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = url.trim();
    if (!isValidLinkedInUrl(trimmed)) {
      setError("Please enter a valid LinkedIn company URL");
      return;
    }
    setLoading(true);
    try {
      toast.info("Starting intelligence pipeline...");
      const res = await fetch("/api/pipeline/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedinUrl: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = typeof data.error === "string" ? data.error : "Failed to start pipeline.";
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Pipeline started!");
      router.push(`/companies/${data.companyId}?run=${data.pipelineRunId}`);
    } catch {
      setError("Network error. Please try again.");
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return companies;
    const q = searchQuery.toLowerCase();
    return companies.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.industry && c.industry.toLowerCase().includes(q)) ||
        (c.location && c.location.toLowerCase().includes(q))
    );
  }, [companies, searchQuery]);

  const totalContacts = useMemo(
    () => companies.reduce((acc, c) => acc + (c._count?.employees || 0), 0),
    [companies]
  );

  return (
    <div className="space-y-12 animate-fade-in">

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="pt-8 pb-4 max-w-2xl">
        <div className="b-mono mb-4 flex items-center gap-2">
          <Flame className="w-3 h-3" style={{ color: "var(--text-subtle)" }} />
          <span style={{ color: "var(--text-subtle)" }}>Job Seeker Outreach Intelligence Engine</span>
        </div>

        <h1 className="font-bold tracking-tight mb-4" style={{ fontSize: "clamp(28px,5vw,48px)", lineHeight: 1.1, color: "var(--text)", letterSpacing: "-0.03em" }}>
          Find Key Decision-Makers.<br />
          Send Perfect Cold Emails.
        </h1>

        <p className="mb-8 text-sm leading-relaxed" style={{ color: "var(--text-muted)", maxWidth: "480px" }}>
          Paste any LinkedIn company URL. We automatically find Engineering Managers &amp;
          Founders, discover verified work emails, and craft hyper-personalized cold outreach.
        </p>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="space-y-3 max-w-xl">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                style={{ color: "var(--text-subtle)" }} />
              <input
                id="linkedin-url-input"
                type="url"
                placeholder="https://www.linkedin.com/company/stripe"
                value={url}
                onChange={e => { setUrl(e.target.value); setError(""); }}
                disabled={loading}
                className="b-input"
                style={{ paddingLeft: "32px", height: "38px" }}
              />
            </div>
            <button
              id="analyze-btn"
              type="submit"
              disabled={loading || !url.trim()}
              className="b-btn b-btn-primary flex-shrink-0"
            >
              {loading ? (
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              Analyze
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--error)" }}>
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick samples */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="b-mono">try:</span>
            {SAMPLE_COMPANIES.map(s => (
              <button
                key={s.name}
                type="button"
                onClick={() => { setUrl(s.url); setError(""); }}
                className="b-mono px-2 py-0.5 rounded transition-colors"
                style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-2)"; (e.currentTarget as HTMLElement).style.color = "var(--text)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
              >
                {s.name}
              </button>
            ))}
          </div>
        </form>
      </section>

      {/* ── Stats row ────────────────────────────────── */}
      <section className="grid grid-cols-3 gap-px" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        {[
          { label: "Companies Analyzed", value: companies.length, icon: Building2 },
          { label: "Decision-Makers Found", value: totalContacts, icon: Users },
          { label: "Safe Send Rate", value: "100%", icon: Mail },
        ].map(({ label, value, icon: Icon }, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-4" style={{ background: "var(--bg-1)", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
            <Icon className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-subtle)" }} />
            <div>
              <div className="b-stat" style={{ fontSize: "22px" }}>{value}</div>
              <div className="b-mono">{label}</div>
            </div>
          </div>
        ))}
      </section>

      {/* ── How it works ─────────────────────────────── */}
      <section>
        <div className="b-section-title mb-4">How the outreach engine works</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          {WORKFLOW_STEPS.map((step, i) => (
            <div key={step.step} className="p-5 group transition-colors"
              style={{ background: "var(--bg-1)", borderRight: i < 3 ? "1px solid var(--border)" : "none" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-2)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-1)"}
            >
              <div className="b-mono mb-3" style={{ color: "var(--text-subtle)" }}>step {step.step}</div>
              <div className="font-semibold text-sm mb-1.5" style={{ color: "var(--text)" }}>{step.title}</div>
              <div className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Companies list ───────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="b-section-title">Analyzed Companies</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>
              {filteredCompanies.length} {filteredCompanies.length === 1 ? "company" : "companies"}
            </div>
          </div>
          {companies.length > 0 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
                style={{ color: "var(--text-subtle)" }} />
              <input
                id="company-search-input"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="b-input"
                style={{ paddingLeft: "28px", width: "180px", height: "32px", fontSize: "12px" }}
              />
            </div>
          )}
        </div>

        {loadingList ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="b-shimmer h-28" />
            ))}
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="b-card text-center py-16 px-8">
            <Building2 className="w-8 h-8 mx-auto mb-4" style={{ color: "var(--text-subtle)" }} />
            <div className="font-semibold text-sm mb-1" style={{ color: "var(--text)" }}>
              {searchQuery ? "No matching companies" : "No companies analyzed yet"}
            </div>
            <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
              {searchQuery
                ? `No results for "${searchQuery}"`
                : "Paste a LinkedIn company URL above to start."}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setUrl(SAMPLE_COMPANIES[0].url)}
                className="b-btn b-btn-outline text-xs"
              >
                Try {SAMPLE_COMPANIES[0].name}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCompanies.map(company => {
              const lastRun = company.pipelineRuns?.[0];
              const isDone = lastRun?.stage === "DONE";
              const isRunning = lastRun && lastRun.stage !== "DONE" && lastRun.stage !== "FAILED";

              return (
                <Link
                  key={company.id}
                  href={`/companies/${company.id}`}
                  className="b-card p-4 flex flex-col justify-between group transition-all"
                  style={{ minHeight: "110px", textDecoration: "none" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-focus)"; (e.currentTarget as HTMLElement).style.background = "var(--bg-2)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.background = "var(--bg-1)"; }}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: "var(--bg-3)", color: "var(--text)" }}>
                        {(company.name ?? "?")[0].toUpperCase()}
                      </div>
                      <div>
                        {isRunning ? (
                          <span className="b-badge">
                            <Clock className="w-2.5 h-2.5 b-pulse" /> Processing
                          </span>
                        ) : isDone ? (
                          <span className="b-badge b-badge-success">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Ready
                          </span>
                        ) : (
                          <span className="b-badge">Ready</span>
                        )}
                      </div>
                    </div>

                    <div className="font-semibold text-sm mb-0.5 truncate" style={{ color: "var(--text)" }}>
                      {company.name ?? "Analyzing..."}
                    </div>
                    <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                      {company.industry ?? "Technology"}
                      {company.location ? ` · ${company.location}` : ""}
                    </div>
                  </div>

                  {isRunning && (
                    <div className="my-2">
                      <div className="b-progress">
                        <div className="b-progress-bar" style={{ width: `${lastRun.progress}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 mt-2"
                    style={{ borderTop: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      <Users className="w-3 h-3" />
                      <span>{company._count?.employees || 0} contacts</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium transition-colors group-hover:opacity-100 opacity-40"
                      style={{ color: "var(--text)" }}>
                      <span>Open</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
