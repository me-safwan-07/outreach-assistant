"use client";

import { useState, useEffect } from "react";
import {
  User, Sliders, Save, Sparkles, KeyRound, BarChart3,
  ExternalLink, Code, Briefcase, GraduationCap, Globe,
  MapPin, FileText, Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Settings {
  name: string; role: string; location: string;
  education: string; experience: string; techStack: string;
  portfolioUrl: string;
  maxApifyCalls: number; maxHunterCalls: number; maxGeminiCalls: number;
}

const RESUME_DRIVE_URL = "https://drive.google.com/file/d/1F0G0wM91fEoH-l9P_nzDitqvPEJ6T-aH/view?usp=sharing";
const RESUME_LOCAL_PATH = "C:\\Users\\amrin\\Documents\\SAFWAN-RESUME.pdf";

type Tab = "PROFILE" | "SMTP" | "API_LIMITS";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "PROFILE",    label: "Candidate Profile",    icon: User },
  { id: "SMTP",       label: "Email & Resume",        icon: Rocket },
  { id: "API_LIMITS", label: "API Quotas",            icon: KeyRound },
];

function Field({
  label, icon: Icon, children,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5" style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: 500, letterSpacing: "0.02em" }}>
        <Icon className="w-3 h-3" />
        <span className="uppercase tracking-widest text-[10px]">{label}</span>
      </label>
      {children}
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="b-card overflow-hidden">
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>{title}</div>
        {desc && <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{desc}</div>}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("PROFILE");

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(data => setSettings(data.settings))
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) toast.success("Settings saved");
      else toast.error("Failed to save settings");
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  function update(key: keyof Settings, value: string | number) {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev);
  }

  const limits: { key: string; label: string; desc: string; max: number }[] = [
    { key: "apify_company",    label: "Apify Company Scraper",    desc: "LinkedIn company metadata & employee count", max: settings?.maxApifyCalls ?? 100 },
    { key: "apify_employees",  label: "Apify Employee Scraper",   desc: "Decision-maker extraction & titles",         max: settings?.maxApifyCalls ?? 100 },
    { key: "hunter",           label: "Findymail / Email Finder", desc: "Free-tier work email lookup quota",          max: settings?.maxHunterCalls ?? 25 },
    { key: "gemini",           label: "Gemini AI Generator",      desc: "Tailored cold pitch generation quota",       max: settings?.maxGeminiCalls ?? 100 },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">

      {/* Header */}
      <div>
        <div className="b-section-title mb-1 flex items-center gap-2">
          <Sliders className="w-3 h-3" />
          Settings
        </div>
        <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>
          Outreach Profile & Configuration
        </h1>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Manage your candidate profile, email credentials, and API quotas.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className="b-nav-link"
            style={activeTab === id ? {
              background: "var(--bg-2)",
              color: "var(--text)",
              borderColor: "var(--border)",
            } : {}}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="space-y-3">
          <div className="b-shimmer h-40 rounded" />
          <div className="b-shimmer h-40 rounded" />
        </div>
      ) : activeTab === "PROFILE" ? (

        /* ── Profile tab ──────────────────────────────── */
        <form onSubmit={handleSave} className="space-y-4">
          {/* AI context banner */}
          <div className="b-code-block">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--text-subtle)" }} />
              <div>
                <div className="text-xs font-medium mb-0.5" style={{ color: "var(--text)" }}>
                  AI context for cold email generation
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Gemini uses these fields to weave your engineering achievements, projects,
                  and tech stack into personalized 130-word pitches.
                </div>
              </div>
            </div>
          </div>

          <Section title="Identity" desc="Your name, target role, and location">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name" icon={User}>
                <Input value={settings?.name ?? ""} onChange={e => update("name", e.target.value)} placeholder="Muhammed Safwan" />
              </Field>
              <Field label="Target Role" icon={Briefcase}>
                <Input value={settings?.role ?? ""} onChange={e => update("role", e.target.value)} placeholder="Full Stack Developer" />
              </Field>
              <Field label="Location" icon={MapPin}>
                <Input value={settings?.location ?? ""} onChange={e => update("location", e.target.value)} placeholder="Bengaluru, Karnataka, India" />
              </Field>
              <Field label="Portfolio / Resume Link" icon={Globe}>
                <Input type="url" value={settings?.portfolioUrl ?? ""} onChange={e => update("portfolioUrl", e.target.value)} placeholder={RESUME_DRIVE_URL} />
              </Field>
            </div>
          </Section>

          <Section title="Technical Background" desc="Skills, education, and work history used in AI drafts">
            <Field label="Tech Stack & Tools" icon={Code}>
              <Input
                value={settings?.techStack ?? ""}
                onChange={e => update("techStack", e.target.value)}
                placeholder="Next.js, React, TypeScript, Node.js, PostgreSQL, Prisma, Tailwind CSS"
              />
            </Field>
            <Field label="Education" icon={GraduationCap}>
              <Input
                value={settings?.education ?? ""}
                onChange={e => update("education", e.target.value)}
                placeholder="B.Com in Computer Applications, Mangalore University (2022–2025)"
              />
            </Field>
            <Field label="Key Experience & Projects" icon={Sparkles}>
              <textarea
                value={settings?.experience ?? ""}
                onChange={e => update("experience", e.target.value)}
                rows={4}
                className="b-input"
                style={{ resize: "none", lineHeight: 1.6, minHeight: "96px" }}
                placeholder="Freelance Full Stack Developer at Projextly; Intern at Supperb; Built Playform..."
              />
            </Field>
          </Section>

          <div className="flex justify-end">
            <Button type="submit" isLoading={saving}>
              <Save className="w-3.5 h-3.5" />
              Save Profile
            </Button>
          </div>
        </form>

      ) : activeTab === "SMTP" ? (

        /* ── Email & Resume tab ───────────────────────── */
        <div className="space-y-4">

          {/* Resume section */}
          <Section title="Resume Attachment" desc="Automatically attached when you click Send Email">
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  <FileText className="w-3.5 h-3.5" />
                  <span>Local PDF path</span>
                </div>
                <code className="b-mono select-all">{RESUME_LOCAL_PATH}</code>
              </div>
              <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  <Globe className="w-3.5 h-3.5" />
                  <span>Online link</span>
                </div>
                <a
                  href={RESUME_DRIVE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
                  style={{ color: "var(--text)" }}
                >
                  Google Drive <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span className="b-badge b-badge-success">✓ File Detected & Attached</span>
                <a
                  href="/resume.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="b-btn b-btn-outline"
                  style={{ padding: "4px 10px", fontSize: "11px" }}
                >
                  <ExternalLink className="w-3 h-3" />
                  Preview PDF
                </a>
              </div>
            </div>
          </Section>

          {/* SMTP section */}
          <Section
            title="Direct Email Dispatch (Gmail / SMTP)"
            desc="SMTP settings are loaded only from the environment file and cannot be changed here."
          >
            <div className="b-code-block flex-col items-start gap-2" style={{ padding: "12px 14px" }}>
              <div className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                Configure SMTP in .env
              </div>
              <div className="space-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
                <div><code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>, and <code>SMTP_PASS</code> are required.</div>
                <div><code>SMTP_FROM_EMAIL</code> is optional and defaults to <code>SMTP_USER</code>.</div>
                <div>Restart the app after changing <code>.env</code>. Secrets are not displayed here.</div>
              </div>
            </div>
          </Section>
        </div>

      ) : (

        /* ── API Quotas tab ───────────────────────────── */
        <div className="space-y-4">
          <Section
            title="Daily API Rate Limits"
            desc="Hard caps that prevent unexpected overages on third-party scraper and email-finder APIs."
          >
            <div className="space-y-0">
              {limits.map((item, i) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between py-3"
                  style={{ borderBottom: i < limits.length - 1 ? "1px solid var(--border)" : "none" }}
                >
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{item.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{item.desc}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <span className="b-badge">
                      <BarChart3 className="w-2.5 h-2.5" />
                      Max {item.max}/day
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="b-mono">Providers: Apify · Findymail · Gemini 2.5 Flash</span>
              <span className="b-badge b-badge-success">✓ Quotas Enforced</span>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
