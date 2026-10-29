"use client";

import { useState, useEffect } from "react";
import {
  X,
  Copy,
  Check,
  Send,
  Sparkles,
  ExternalLink,
  Mail,
  AlertTriangle,
  FileText,
  Clock,
  MessageSquare,
  ShieldCheck,
  Rocket,
  Pencil,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";

interface EmailDraft {
  id: string;
  subject: string;
  body: string;
  model: string;
  status: "DRAFT" | "COPIED" | "SENT" | "REPLIED";
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    headline: string | null;
    currentTitle: string | null;
    linkedinUrl: string;
    emailLookups: Array<{
      email: string | null;
      status: string;
      confidence: number | null;
    }>;
  };
}

interface Props {
  draftId: string;
  onClose: () => void;
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft", icon: Clock },
  { value: "COPIED", label: "Copied", icon: Copy },
  { value: "SENT", label: "Sent", icon: Send },
  { value: "REPLIED", label: "Replied", icon: MessageSquare },
] as const;

const RESUME_DRIVE_URL =
  "https://drive.google.com/file/d/1F0G0wM91fEoH-l9P_nzDitqvPEJ6T-aH/view?usp=sharing";

export default function EmailDrawer({ draftId, onClose }: Props) {
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingDirect, setSendingDirect] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [status, setStatus] = useState<"DRAFT" | "COPIED" | "SENT" | "REPLIED">("DRAFT");
  const [smtpError, setSmtpError] = useState<string | null>(null);
  const [saveTimeout, setSaveTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/drafts/${draftId}`)
      .then((r) => r.json())
      .then((d: EmailDraft) => {
        setDraft(d);
        setSubject(d.subject);
        setBody(d.body);
        setStatus(d.status);
        setRecipientEmail(d.employee.emailLookups[0]?.email ?? "");
      })
      .catch(() => {
        toast.error("Failed to load email pitch");
      })
      .finally(() => setLoading(false));
  }, [draftId]);

  // Auto-save on change (debounced 800ms)
  function triggerSave(nextSubject: string, nextBody: string, nextStatus: string) {
    if (saveTimeout) clearTimeout(saveTimeout);
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch(`/api/drafts/${draftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject: nextSubject, body: nextBody, status: nextStatus }),
        });
      } catch {
        toast.error("Failed to auto-save");
      } finally {
        setSaving(false);
      }
    }, 800);
    setSaveTimeout(t);
  }

  function handleSubjectChange(v: string) {
    setSubject(v);
    triggerSave(v, body, status);
  }

  function handleBodyChange(v: string) {
    setBody(v);
    triggerSave(subject, v, status);
  }

  function handleStatusChange(v: "DRAFT" | "COPIED" | "SENT" | "REPLIED") {
    setStatus(v);
    triggerSave(subject, body, v);
    toast.success(`Pitch status updated to ${v}`);
  }

  async function handleSaveRecipientEmail() {
    if (!draft) return;
    const trimmed = recipientEmail.trim();
    if (!trimmed || !trimmed.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    setSavingEmail(true);
    try {
      const res = await fetch(`/api/employees/${draft.employee.id}/email`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        setDraft((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            employee: {
              ...prev.employee,
              emailLookups: [
                {
                  email: trimmed,
                  status: "FOUND",
                  confidence: 100,
                },
              ],
            },
          };
        });
        setIsEditingEmail(false);
        toast.success(`Recruiter email updated to ${trimmed}!`);
      } else {
        toast.error(data.error || "Failed to update email");
      }
    } catch {
      toast.error("Network error while updating email");
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleDirectSend() {
    setSendingDirect(true);
    setSmtpError(null);
    try {
      const res = await fetch(`/api/drafts/${draftId}/send`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setStatus("SENT");
        toast.success("Email sent directly!", {
          description: `Delivered to ${draft?.employee.emailLookups[0]?.email} with SAFWAN-RESUME.pdf attached.`,
        });
      } else {
        if (!data.smtpConfigured) {
          setSmtpError(
            "SMTP password required: Add your Gmail App Password in Settings to enable direct 1-click background dispatch."
          );
        } else {
          setSmtpError(data.error || "Failed to dispatch email");
        }
        toast.error(data.error || "Could not dispatch email directly");
      }
    } catch {
      toast.error("Network error while sending email");
    } finally {
      setSendingDirect(false);
    }
  }

  async function handleCopy() {
    const text = `Subject: ${subject}\n\n${body}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied email to clipboard!", {
      description: "Subject and body copied. Ready to paste into Gmail or Outlook.",
    });

    await fetch(`/api/drafts/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COPIED" }),
    });
    setStatus("COPIED");
  }

  function handleMailto() {
    const email = recipientEmail || draft?.employee.emailLookups[0]?.email || "";
    const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    toast.info("Opening mail client...");
  }

  async function handleRegenerate() {
    setRegenerating(true);
    toast.info("Regenerating pitch with Gemini AI...", {
      description: "Tailoring pitch with Muhammed Safwan's resume credentials.",
    });
    try {
      const res = await fetch(`/api/drafts/${draftId}/regenerate`, { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        setSubject(d.subject);
        setBody(d.body);
        setStatus("DRAFT");
        toast.success("New personalized pitch generated!");
      } else {
        toast.error("Failed to regenerate pitch");
      }
    } catch {
      toast.error("Network error while regenerating");
    } finally {
      setRegenerating(false);
    }
  }

  const lookup = draft?.employee.emailLookups[0];
  const words = countWords(body);
  const isWordCountOptimal = words >= 110 && words <= 190;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 transition-opacity animate-in fade-in-0"
        style={{ background: "rgba(0, 0, 0, 0.85)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div
        className="relative w-full max-w-xl border-l border-[var(--border)] shadow-2xl z-10 flex flex-col h-full animate-in slide-in-from-right duration-200"
        style={{ background: "var(--bg-1)" }}
      >
        {/* Top Header */}
        <div
          className="p-5 border-b border-[var(--border)] flex items-start justify-between"
          style={{ background: "var(--bg-1)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center font-bold text-xs"
              style={{
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text)",
              }}
            >
              {draft ? `${draft.employee.firstName[0]}${draft.employee.lastName[0] || ""}` : "—"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[var(--text)] leading-none">
                  {draft?.employee.firstName} {draft?.employee.lastName}
                </h2>
                {lookup?.status === "FOUND" && (
                  <span className="b-badge b-badge-success text-[10px] py-0">
                    <ShieldCheck className="w-3 h-3" />
                    Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1 truncate max-w-xs">
                {draft?.employee.currentTitle ?? draft?.employee.headline ?? "Decision-Maker"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {saving && (
              <span className="b-mono text-[10px] text-[var(--text-subtle)] animate-pulse">saving...</span>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] rounded transition-colors"
              style={{ borderRadius: "var(--radius-sm)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="space-y-3">
              <div className="b-shimmer h-10" />
              <div className="b-shimmer h-40" />
              <div className="b-shimmer h-20" />
            </div>
          ) : (
            <>
              {/* Direct Resume Attachment Card */}
              <div
                className="p-3.5 space-y-2 border border-[var(--border)]"
                style={{ background: "var(--bg)", borderRadius: "var(--radius)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span className="text-xs font-semibold text-[var(--text)]">
                      Resume Attached: <span className="b-mono font-normal">SAFWAN-RESUME.pdf</span>
                    </span>
                  </div>
                  <span className="b-badge b-badge-success text-[10px] py-0">
                    Auto-Attached
                  </span>
                </div>
                <p className="text-xs text-[var(--text-subtle)] leading-relaxed">
                  Direct sends will automatically bundle your resume PDF with this outreach email.
                </p>
                <div className="flex items-center gap-3 pt-0.5 text-xs">
                  <a
                    href="/resume.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="b-mono text-xs text-[var(--text-muted)] hover:text-[var(--text)] flex items-center gap-1 underline underline-offset-4"
                  >
                    <span>View PDF</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <span className="text-[var(--border-2)]">•</span>
                  <a
                    href={RESUME_DRIVE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="b-mono text-xs text-[var(--text-muted)] hover:text-[var(--text)] flex items-center gap-1 underline underline-offset-4"
                  >
                    <span>Drive Mirror</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* SMTP Error Callout */}
              {smtpError && (
                <div
                  className="p-3.5 text-xs space-y-2 border border-amber-500/30 text-amber-300"
                  style={{ background: "rgba(250,204,21,0.05)", borderRadius: "var(--radius)" }}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span>{smtpError}</span>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <Link
                      href="/settings"
                      className="b-mono underline font-medium hover:text-white"
                    >
                      Configure Settings →
                    </Link>
                    <button
                      onClick={handleMailto}
                      className="b-mono underline hover:text-white"
                    >
                      Or Open Mail Client
                    </button>
                  </div>
                </div>
              )}

              {/* Editable Recipient Email Box */}
              <div
                className="p-3.5 space-y-2 border border-[var(--border)]"
                style={{ background: "var(--bg)", borderRadius: "var(--radius)" }}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-[var(--text-muted)]">
                    <Mail className="w-3.5 h-3.5" />
                    <span className="b-section-title" style={{ fontSize: "10px" }}>Recipient Work Email</span>
                  </div>
                  <a
                    href={draft?.employee.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="b-mono flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text)] text-[11px]"
                  >
                    <span>LinkedIn</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {isEditingEmail ? (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="e.g. lead@company.com"
                      className="b-input b-mono flex-1 text-xs"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="default"
                      isLoading={savingEmail}
                      onClick={handleSaveRecipientEmail}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setRecipientEmail(draft?.employee.emailLookups[0]?.email ?? "");
                        setIsEditingEmail(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="b-mono text-xs text-[var(--text)] truncate select-all">
                        {recipientEmail || "No email discovered"}
                      </span>
                      {lookup?.status === "FOUND" && (
                        <span className="b-badge b-badge-success text-[10px] py-0">
                          Verified
                        </span>
                      )}
                      {lookup?.status === "GUESSED_UNVERIFIED" && (
                        <span className="b-badge b-badge-warning text-[10px] py-0">
                          Pattern Guess
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setIsEditingEmail(true)}
                      className="b-btn b-btn-outline"
                      style={{ padding: "3px 8px", fontSize: "11px" }}
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit
                    </button>
                  </div>
                )}
              </div>

              {/* Subject Input */}
              <div className="space-y-1.5">
                <label className="b-section-title block">Subject Line</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  className="b-input"
                  placeholder="Subject line..."
                />
              </div>

              {/* Body Textarea with Word Count & Optimization Guide */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="b-section-title">Personalized Pitch</label>
                  <div className="flex items-center gap-1.5 b-mono text-[11px]">
                    <span
                      className={
                        isWordCountOptimal
                          ? "text-emerald-400"
                          : words < 100
                          ? "text-amber-400"
                          : "text-rose-400"
                      }
                    >
                      {words} words
                    </span>
                    <span className="text-[var(--text-subtle)]">
                      {isWordCountOptimal
                        ? "(optimal: 120-180)"
                        : words < 100
                        ? "(aim for 120+)"
                        : "(under 200 recommended)"}
                    </span>
                  </div>
                </div>
                <textarea
                  value={body}
                  onChange={(e) => handleBodyChange(e.target.value)}
                  rows={13}
                  className="b-input font-mono text-xs leading-relaxed resize-none p-3.5"
                  style={{ minHeight: "260px" }}
                  placeholder="Email pitch content..."
                />
              </div>

              {/* Status Workflow Selector */}
              <div
                className="p-3 space-y-2 border border-[var(--border)]"
                style={{ background: "var(--bg)", borderRadius: "var(--radius)" }}
              >
                <span className="b-section-title block" style={{ fontSize: "10px" }}>Outreach Lifecycle Status</span>
                <div className="grid grid-cols-4 gap-1">
                  {STATUS_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isActive = status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleStatusChange(opt.value)}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-medium transition-colors"
                        style={{
                          borderRadius: "var(--radius-sm)",
                          background: isActive ? "var(--text)" : "var(--bg-1)",
                          color: isActive ? "var(--bg)" : "var(--text-muted)",
                          border: isActive ? "1px solid var(--text)" : "1px solid var(--border)",
                        }}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Action Footer */}
        <div
          className="p-4 border-t border-[var(--border)] flex items-center gap-2"
          style={{ background: "var(--bg-1)" }}
        >
          {/* PRIMARY: DIRECT SEND BUTTON */}
          <Button
            onClick={handleDirectSend}
            variant="default"
            isLoading={sendingDirect}
            className="flex-1 h-9"
          >
            <Rocket className="w-3.5 h-3.5 mr-1.5" />
            <span>Send Direct (1-Click)</span>
          </Button>

          {/* SECONDARY: COPY */}
          <Button
            onClick={handleCopy}
            variant="outline"
            className="h-9 px-3"
            title="Copy subject and body to clipboard"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </Button>

          {/* SECONDARY: MAILTO */}
          <Button
            onClick={handleMailto}
            variant="outline"
            className="h-9 px-3"
            title="Open in external mail client"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>

          {/* REGENERATE */}
          <Button
            onClick={handleRegenerate}
            variant="ghost"
            isLoading={regenerating}
            className="h-9 px-3 text-[var(--text-muted)] hover:text-[var(--text)]"
            title="Regenerate with Gemini AI"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
