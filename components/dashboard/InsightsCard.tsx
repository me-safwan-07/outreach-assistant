"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, CheckCircle2, AlertCircle, Info, ArrowRight, ExternalLink } from "lucide-react";

export interface InsightItem {
  type: "success" | "info" | "warning";
  title: string;
  desc: string;
}

interface Props {
  insights: InsightItem[];
}

export function InsightsCard({ insights }: Props) {
  if (!insights || insights.length === 0) return null;

  return (
    <div
      className="p-4 rounded border space-y-3"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
        borderColor: "var(--border)",
        borderRadius: "var(--radius)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="b-section-title">Smart Outreach Insights</span>
        </div>
        <span className="b-mono text-[10px]" style={{ color: "var(--text-subtle)" }}>
          Real-time AI telemetry
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {insights.map((item, idx) => {
          const isWarning = item.type === "warning";
          const isSuccess = item.type === "success";

          return (
            <div
              key={idx}
              className="p-3 rounded border flex items-start gap-3 transition-colors"
              style={{
                background: "var(--bg-1)",
                borderColor: isWarning
                  ? "rgba(248,113,113,0.3)"
                  : isSuccess
                  ? "rgba(74,222,128,0.2)"
                  : "var(--border)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <div className="flex-shrink-0 mt-0.5">
                {isWarning ? (
                  <AlertCircle className="w-4 h-4 text-[var(--error)]" />
                ) : isSuccess ? (
                  <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                ) : (
                  <Info className="w-4 h-4 text-[var(--info)]" />
                )}
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="text-xs font-semibold text-[var(--text)]">
                  {item.title}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  {item.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
