"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Download,
  Calendar,
  Sparkles,
  Clock,
  Check,
} from "lucide-react";
import { toast } from "sonner";

export type TimeFilterRange = "daily" | "weekly" | "monthly" | "all";

interface Props {
  range: TimeFilterRange;
  onRangeChange: (r: TimeFilterRange) => void;
  loading: boolean;
  onRefresh: () => void;
  lastRefresh: Date;
  autoRefreshInterval: number;
  onAutoRefreshChange: (sec: number) => void;
  onExportCsv: () => void;
}

const RANGES: { key: TimeFilterRange; label: string; sub: string }[] = [
  { key: "daily", label: "Daily", sub: "Last 24h" },
  { key: "weekly", label: "Weekly", sub: "Last 7d" },
  { key: "monthly", label: "Monthly", sub: "Last 30d" },
  { key: "all", label: "All-Time", sub: "Lifetime" },
];

export function DashboardHeader({
  range,
  onRangeChange,
  loading,
  onRefresh,
  lastRefresh,
  autoRefreshInterval,
  onAutoRefreshChange,
  onExportCsv,
}: Props) {
  const [showAutoRefreshMenu, setShowAutoRefreshMenu] = useState(false);

  function formatTimeAgo(d: Date): string {
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 5) return "just now";
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }

  return (
    <div className="space-y-4">
      {/* Top row: Title + Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">
              Analytics & Outreach Intelligence
            </h1>
            <span className="b-badge b-badge-success flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Telemetry
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Real-time funnel conversion rates, lead discovery velocity, and delivery analytics
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Auto Refresh dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowAutoRefreshMenu(!showAutoRefreshMenu)}
              className="b-btn b-btn-outline text-xs px-2.5 py-1.5 flex items-center gap-1.5"
              title="Configure auto refresh rate"
            >
              <Clock className="w-3 h-3 text-[var(--text-subtle)]" />
              <span>
                {autoRefreshInterval > 0 ? `${autoRefreshInterval}s auto` : "Auto: Off"}
              </span>
            </button>

            {showAutoRefreshMenu && (
              <div
                className="absolute right-0 mt-1 w-36 rounded shadow-xl border p-1 z-50 backdrop-blur-md"
                style={{ background: "var(--bg-1)", borderColor: "var(--border-2)" }}
              >
                {[
                  { sec: 0, label: "Manual only" },
                  { sec: 30, label: "Every 30s" },
                  { sec: 60, label: "Every 60s" },
                  { sec: 300, label: "Every 5m" },
                ].map((opt) => (
                  <button
                    key={opt.sec}
                    onClick={() => {
                      onAutoRefreshChange(opt.sec);
                      setShowAutoRefreshMenu(false);
                      toast.success(
                        opt.sec > 0
                          ? `Auto refresh set to ${opt.label}`
                          : "Auto refresh disabled"
                      );
                    }}
                    className="w-full text-left px-2 py-1.5 text-xs rounded flex items-center justify-between hover:bg-[var(--bg-2)] transition-colors"
                  >
                    <span>{opt.label}</span>
                    {autoRefreshInterval === opt.sec && (
                      <Check className="w-3 h-3 text-[var(--success)]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export Report CSV */}
          <button
            onClick={onExportCsv}
            className="b-btn b-btn-outline text-xs px-2.5 py-1.5 flex items-center gap-1.5"
            title="Download CSV analytics report"
          >
            <Download className="w-3 h-3 text-[var(--text-subtle)]" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="b-btn b-btn-outline text-xs px-2.5 py-1.5 flex items-center gap-1.5"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
            {!loading && (
              <span className="b-mono text-[10px] text-[var(--text-subtle)] hidden sm:inline">
                ({formatTimeAgo(lastRefresh)})
              </span>
            )}
          </button>

          {/* New Company link */}
          <Link
            href="/"
            className="b-btn b-btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            <Sparkles className="w-3 h-3" />
            <span>New Pipeline</span>
          </Link>
        </div>
      </div>

      {/* Filter Options: Daily / Weekly / Monthly / All-Time Pill Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div
          className="inline-flex p-1 rounded border items-center gap-1"
          style={{ background: "var(--bg-1)", borderColor: "var(--border)" }}
        >
          {RANGES.map((r) => {
            const isActive = range === r.key;
            return (
              <button
                key={r.key}
                onClick={() => onRangeChange(r.key)}
                className="px-3 py-1.5 text-xs rounded font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                style={{
                  background: isActive ? "var(--bg-3)" : "transparent",
                  color: isActive ? "#ffffff" : "var(--text-muted)",
                  border: `1px solid ${isActive ? "var(--border-focus)" : "transparent"}`,
                  boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
                }}
              >
                <Calendar className="w-3 h-3 opacity-70" />
                <span>{r.label}</span>
                <span
                  className="b-mono text-[10px] hidden sm:inline"
                  style={{ opacity: isActive ? 0.9 : 0.6 }}
                >
                  ({r.sub})
                </span>
              </button>
            );
          })}
        </div>

        <div className="b-mono text-xs text-[var(--text-subtle)] flex items-center gap-2">
          <span>Filtering window:</span>
          <span className="text-[var(--text)] font-medium underline decoration-dotted">
            {range === "daily"
              ? "Last 24 Hours (Hourly buckets)"
              : range === "weekly"
              ? "Last 7 Days (Daily buckets)"
              : range === "monthly"
              ? "Last 30 Days (Daily buckets)"
              : "All-Time Overview (Multi-week buckets)"}
          </span>
        </div>
      </div>
    </div>
  );
}
