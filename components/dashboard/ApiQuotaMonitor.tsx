"use client";

import React from "react";
import { Zap, AlertTriangle, CheckCircle, ShieldCheck } from "lucide-react";

interface QuotaItem {
  used: number;
  limit: number;
  percentage: number;
}

interface Props {
  quota: {
    apify: QuotaItem;
    hunter: QuotaItem;
    gemini: QuotaItem;
  };
  apiUsage: Record<string, { date: string; count: number }[]>;
}

const PROVIDER_NAMES: Record<string, string> = {
  apify: "Apify Scraping",
  apify_employees: "Apify Employees",
  apify_company: "Apify Company",
  hunter: "Hunter Email Finder",
  findymail: "Findymail API",
  prospeo: "Prospeo API",
  tomba: "Tomba Finder",
  gemini: "Gemini AI LLM",
  pattern_guesser: "Pattern Guesser",
};

export function ApiQuotaMonitor({ quota, apiUsage }: Props) {
  // Aggregate all providers from apiUsage
  const providers = Object.entries(apiUsage).map(([key, list]) => ({
    key,
    name: PROVIDER_NAMES[key] || key,
    total: list.reduce((a, b) => a + b.count, 0),
  })).sort((a, b) => b.total - a.total);

  const maxTotal = Math.max(...providers.map((p) => p.total), 1);

  return (
    <div className="b-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="b-section-title flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" style={{ color: "var(--warning)" }} />
          API Health & Quota Utilization
        </div>
        <span className="b-mono" style={{ fontSize: "11px", color: "var(--text-subtle)" }}>
          Active Limits
        </span>
      </div>

      {/* Main Quota Bars for Apify, Hunter, Gemini */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Apify */}
        <div className="p-3 rounded border" style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[var(--text)]">Apify Scraper</span>
            <span className="b-mono" style={{ fontSize: "10px", color: quota.apify.percentage >= 80 ? "var(--error)" : "var(--text-subtle)" }}>
              {quota.apify.percentage}%
            </span>
          </div>
          <div className="mt-2 text-sm font-bold tabular-nums">
            {quota.apify.used} <span className="text-xs font-normal text-[var(--text-subtle)]">/ {quota.apify.limit}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden mt-2 bg-[var(--bg-3)]">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, quota.apify.percentage)}%`,
                background: quota.apify.percentage >= 80 ? "var(--error)" : "var(--info)",
              }}
            />
          </div>
        </div>

        {/* Hunter */}
        <div className="p-3 rounded border" style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[var(--text)]">Hunter.io</span>
            <span className="b-mono" style={{ fontSize: "10px", color: quota.hunter.percentage >= 80 ? "var(--error)" : "var(--text-subtle)" }}>
              {quota.hunter.percentage}%
            </span>
          </div>
          <div className="mt-2 text-sm font-bold tabular-nums">
            {quota.hunter.used} <span className="text-xs font-normal text-[var(--text-subtle)]">/ {quota.hunter.limit}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden mt-2 bg-[var(--bg-3)]">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, quota.hunter.percentage)}%`,
                background: quota.hunter.percentage >= 80 ? "var(--error)" : "var(--warning)",
              }}
            />
          </div>
        </div>

        {/* Gemini */}
        <div className="p-3 rounded border" style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[var(--text)]">Gemini AI</span>
            <span className="b-mono" style={{ fontSize: "10px", color: quota.gemini.percentage >= 80 ? "var(--error)" : "var(--text-subtle)" }}>
              {quota.gemini.percentage}%
            </span>
          </div>
          <div className="mt-2 text-sm font-bold tabular-nums">
            {quota.gemini.used} <span className="text-xs font-normal text-[var(--text-subtle)]">/ {quota.gemini.limit}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden mt-2 bg-[var(--bg-3)]">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, quota.gemini.percentage)}%`,
                background: quota.gemini.percentage >= 80 ? "var(--error)" : "var(--success)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Detailed breakdown list */}
      {providers.length > 0 && (
        <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="b-mono text-[10px]" style={{ color: "var(--text-subtle)" }}>
            CALL COUNTS BY SERVICE
          </div>
          <div className="space-y-1.5">
            {providers.slice(0, 5).map((p) => (
              <div key={p.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: "var(--text-muted)" }}>{p.name}</span>
                  <span className="font-medium tabular-nums text-[var(--text)]">
                    {p.total.toLocaleString()} calls
                  </span>
                </div>
                <div className="h-1 rounded-full overflow-hidden bg-[var(--bg-3)]">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.round((p.total / maxTotal) * 100)}%`,
                      background: "var(--text-subtle)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
