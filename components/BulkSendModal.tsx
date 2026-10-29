"use client";

import { useState, useMemo } from "react";
import {
  Send,
  ShieldCheck,
  Users,
  Star,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  X,
  Zap,
  SkipForward,
  ChevronDown,
  ChevronUp,
  Mail,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type BulkSendMode = "ALL" | "VERIFIED" | "HIGH_SCORE" | "WITH_DRAFTS";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  relevanceScore: number;
  emailLookups: Array<{ email: string | null; status: string }>;
  emailDrafts: Array<{ id: string; status: string }>;
}

interface BulkSendResultItem {
  employeeId: string;
  name: string;
  email: string;
  success: boolean;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

interface BulkSendSummary {
  sent: number;
  skipped: number;
  failed: number;
  total: number;
}

interface BulkSendModalProps {
  companyId: string;
  companyName: string;
  employees: Employee[];
  onClose: () => void;
  onComplete?: () => void;
}

const SEND_MODES: {
  id: BulkSendMode;
  label: string;
  desc: string;
  icon: React.ElementType;
  badge?: string;
}[] = [
  {
    id: "VERIFIED",
    label: "Verified Emails Only",
    desc: "Send strictly to contacts with a 100% verified work email. Safest option — zero bounces.",
    icon: ShieldCheck,
    badge: "Recommended",
  },
  {
    id: "HIGH_SCORE",
    label: "High Priority (Score ≥ 75)",
    desc: "Send to decision-makers scoring 75+ — Founders, Engineering Leads, and active Recruiters.",
    icon: Star,
  },
  {
    id: "WITH_DRAFTS",
    label: "All With Emails + Drafts",
    desc: "Send to every contact who has both an AI draft and an email address (verified or guessed).",
    icon: FileText,
  },
  {
    id: "ALL",
    label: "All Contacts with Email",
    desc: "Send to all contacts with any email on file. Includes pattern guesses. May have minor bounce risk.",
    icon: Users,
  },
];

function previewCount(employees: Employee[], mode: BulkSendMode): number {
  return employees.filter((emp) => {
    const draft = emp.emailDrafts.find((d) => d.status !== "SENT");
    const lookup = emp.emailLookups[0];
    if (!draft) return false;
    if (mode === "VERIFIED") return lookup?.status === "FOUND" && !!lookup.email;
    if (mode === "HIGH_SCORE") return emp.relevanceScore >= 75 && !!lookup?.email;
    if (mode === "WITH_DRAFTS") return !!lookup?.email;
    if (mode === "ALL") return !!lookup?.email;
    return false;
  }).length;
}

export default function BulkSendModal({
  companyId,
  companyName,
  employees,
  onClose,
  onComplete,
}: BulkSendModalProps) {
  const [selectedMode, setSelectedMode] = useState<BulkSendMode>("VERIFIED");
  const [isSending, setIsSending] = useState(false);
  const [results, setResults] = useState<BulkSendResultItem[] | null>(null);
  const [summary, setSummary] = useState<BulkSendSummary | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const targetCount = useMemo(() => previewCount(employees, selectedMode), [employees, selectedMode]);

  async function handleBulkSend() {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }

    setIsSending(true);
    setResults(null);
    setSummary(null);

    try {
      const res = await fetch("/api/drafts/bulk-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, mode: selectedMode, delayMs: 1200 }),
      });

      const data = await res.json();

      if (!res.ok && !data.results) {
        toast.error(data.error || "Bulk send failed");
        return;
      }

      setResults(data.results ?? []);
      setSummary(data.summary ?? { sent: 0, skipped: 0, failed: 0, total: 0 });

      if (data.smtpConfigured === false) {
        toast.error("SMTP not configured", {
          description: "Go to Settings and add your Gmail App Password to send emails directly.",
        });
      } else if ((data.summary?.sent ?? 0) > 0) {
        toast.success(`Bulk send complete! ${data.summary.sent} emails delivered.`, {
          description: `${data.summary.skipped} skipped, ${data.summary.failed} failed.`,
        });
        onComplete?.();
      }
    } catch {
      toast.error("Network error during bulk send");
    } finally {
      setIsSending(false);
      setConfirmed(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.85)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="b-card relative w-full max-w-xl overflow-hidden shadow-2xl"
        style={{ maxHeight: "90vh", overflowY: "auto", background: "var(--bg-1)" }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-[var(--border)]"
          style={{ background: "var(--bg-1)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 flex items-center justify-center rounded"
              style={{ background: "var(--bg-2)", border: "1px solid var(--border-2)" }}
            >
              <Zap className="w-3.5 h-3.5 text-[var(--text)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[var(--text)]">Bulk Send Outreaches</h2>
                <span className="b-mono b-badge">{employees.length} contacts</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] truncate max-w-sm mt-0.5">{companyName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] rounded transition-colors"
            style={{ borderRadius: "var(--radius-sm)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results View */}
        {results && summary ? (
          <div className="p-5 space-y-4">
            <div
              className="grid grid-cols-3 gap-px"
              style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}
            >
              <div className="p-3 text-center" style={{ background: "var(--bg-1)" }}>
                <div className="b-stat text-emerald-400" style={{ fontSize: "22px" }}>{summary.sent}</div>
                <div className="b-mono text-[10px] text-emerald-400/80">Delivered</div>
              </div>
              <div className="p-3 text-center" style={{ background: "var(--bg-1)" }}>
                <div className="b-stat text-amber-400" style={{ fontSize: "22px" }}>{summary.skipped}</div>
                <div className="b-mono text-[10px] text-amber-400/80">Skipped</div>
              </div>
              <div className="p-3 text-center" style={{ background: "var(--bg-1)" }}>
                <div className="b-stat text-rose-400" style={{ fontSize: "22px" }}>{summary.failed}</div>
                <div className="b-mono text-[10px] text-rose-400/80">Failed</div>
              </div>
            </div>

            <button
              onClick={() => setShowDetails((v) => !v)}
              className="w-full flex items-center justify-between px-3.5 py-2 text-xs rounded border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-2)] transition-colors"
              style={{ borderRadius: "var(--radius-sm)" }}
            >
              <span className="b-mono">Audit Log ({results.length} contacts)</span>
              {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showDetails && (
              <div
                className="space-y-1.5 max-h-60 overflow-y-auto p-2 border border-[var(--border)]"
                style={{ borderRadius: "var(--radius-sm)", background: "var(--bg)" }}
              >
                {results.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 px-3 py-2 text-xs border border-[var(--border)]"
                    style={{
                      borderRadius: "var(--radius-sm)",
                      background: r.success ? "rgba(74,222,128,0.04)" : r.skipped ? "var(--bg-1)" : "rgba(248,113,113,0.04)",
                    }}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {r.skipped ? (
                        <SkipForward className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
                      ) : r.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[var(--text)] flex items-center gap-1.5">
                        <span>{r.name}</span>
                        {r.email && <span className="b-mono text-[10px] text-[var(--text-subtle)] truncate">{r.email}</span>}
                      </div>
                      {(r.skipReason || r.error) && (
                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{r.skipReason || r.error}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
              <Button variant="outline" size="sm" onClick={onClose} className="flex-1">
                Close
              </Button>
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setResults(null);
                  setSummary(null);
                  setShowDetails(false);
                }}
              >
                Send Again
              </Button>
            </div>
          </div>
        ) : (
          /* Configuration View */
          <div className="p-5 space-y-4">
            <div>
              <div className="b-section-title mb-2.5">Select Dispatch Target</div>
              <div className="space-y-1.5">
                {SEND_MODES.map((mode) => {
                  const Icon = mode.icon;
                  const count = previewCount(employees, mode.id);
                  const isSelected = selectedMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => {
                        setSelectedMode(mode.id);
                        setConfirmed(false);
                      }}
                      className="w-full flex items-center gap-3 p-3 text-left transition-all"
                      style={{
                        border: isSelected ? "1px solid var(--text)" : "1px solid var(--border)",
                        background: isSelected ? "var(--bg-2)" : "var(--bg-1)",
                        borderRadius: "var(--radius)",
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                        style={{
                          background: isSelected ? "var(--text)" : "var(--bg-3)",
                          color: isSelected ? "var(--bg)" : "var(--text-muted)",
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs font-semibold"
                            style={{ color: isSelected ? "var(--text)" : "var(--text-muted)" }}
                          >
                            {mode.label}
                          </span>
                          {mode.badge && (
                            <span className="b-badge b-badge-success text-[10px] py-0">
                              {mode.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--text-subtle)] mt-0.5 line-clamp-1">{mode.desc}</p>
                      </div>
                      <div
                        className="b-mono px-2 py-0.5 text-xs font-semibold rounded border"
                        style={{
                          borderColor: isSelected ? "var(--text)" : "var(--border)",
                          color: isSelected ? "var(--text)" : "var(--text-muted)",
                          background: isSelected ? "var(--bg-3)" : "transparent",
                        }}
                      >
                        {count}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Resume Banner */}
            <div
              className="flex items-center gap-2.5 p-3 rounded border border-[var(--border)]"
              style={{ background: "var(--bg)", borderRadius: "var(--radius-sm)" }}
            >
              <FileText className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
              <div className="text-xs text-[var(--text-muted)] flex-1">
                <span className="font-semibold text-[var(--text)]">{targetCount}</span> email
                {targetCount !== 1 ? "s" : ""} will be sent with{" "}
                <span className="b-mono text-[var(--text)]">SAFWAN-RESUME.pdf</span> attached.
              </div>
            </div>

            {targetCount === 0 && (
              <div
                className="flex items-start gap-2 p-3 text-xs border border-amber-500/30 text-amber-300"
                style={{ background: "rgba(250,204,21,0.05)", borderRadius: "var(--radius-sm)" }}
              >
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>No contacts match this filter. Re-run pipeline or choose another target group.</span>
              </div>
            )}

            {confirmed && targetCount > 0 && (
              <div
                className="flex items-start gap-2 p-3 text-xs border border-rose-500/40 text-rose-300"
                style={{ background: "rgba(248,113,113,0.06)", borderRadius: "var(--radius-sm)" }}
              >
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  Confirm send: This will deliver <strong>{targetCount} real emails</strong> via your configured SMTP account.
                </span>
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
              <Button variant="outline" size="sm" onClick={onClose} className="flex-1" disabled={isSending}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant={confirmed ? "destructive" : "default"}
                className="flex-1"
                disabled={targetCount === 0 || isSending}
                onClick={handleBulkSend}
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Sending Batch...
                  </>
                ) : confirmed ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                    Confirm & Send ({targetCount})
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Send Outreaches ({targetCount})
                  </>
                )}
              </Button>
            </div>

            <div className="text-center b-mono text-[10px] text-[var(--text-subtle)]">
              1.2s delay between messages · resume automatically attached
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
