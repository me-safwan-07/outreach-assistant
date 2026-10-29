"use client";

import React from "react";
import { Activity, ChevronRight, TrendingUp, CheckCircle2 } from "lucide-react";

export interface FunnelStepItem {
  label: string;
  value: number;
  allTime?: number;
  color: string;
}

interface Props {
  steps: FunnelStepItem[];
  range: string;
}

export function ConversionFunnelCard({ steps, range }: Props) {
  const maxVal = Math.max(...steps.map((s) => s.value), 1);

  return (
    <div className="b-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="b-section-title flex items-center gap-2">
          <Activity className="w-3.5 h-3.5" style={{ color: "var(--info)" }} />
          Outreach Conversion Funnel
        </div>
        <span className="b-mono" style={{ fontSize: "11px", color: "var(--text-subtle)" }}>
          {range.toUpperCase()}
        </span>
      </div>

      <div className="space-y-3 pt-1">
        {steps.map((step, i) => {
          const pctOfMax = Math.round((step.value / maxVal) * 100);
          const prevStep = i > 0 ? steps[i - 1] : null;
          const convRate =
            prevStep && prevStep.value > 0
              ? Math.round((step.value / prevStep.value) * 100)
              : null;

          return (
            <div key={step.label} className="space-y-1 group">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                  {i > 0 && (
                    <ChevronRight className="w-2.5 h-2.5" style={{ color: "var(--text-subtle)" }} />
                  )}
                  <span className="font-medium group-hover:text-white transition-colors">
                    {step.label}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  {convRate !== null && (
                    <span
                      className="b-mono px-1.5 py-0.5 rounded text-[10px]"
                      style={{
                        background: convRate >= 50 ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.05)",
                        color: convRate >= 50 ? "var(--success)" : "var(--text-subtle)",
                      }}
                      title={`${convRate}% conversion from previous step`}
                    >
                      {convRate}% conv
                    </span>
                  )}
                  <span className="font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                    {step.value.toLocaleString()}
                  </span>
                  {step.allTime !== undefined && (
                    <span
                      className="b-mono hidden sm:inline"
                      style={{ fontSize: "10px", color: "var(--text-subtle)" }}
                    >
                      ({step.allTime.toLocaleString()} total)
                    </span>
                  )}
                </div>
              </div>

              {/* Progress track */}
              <div
                className="h-2 rounded-full overflow-hidden transition-all"
                style={{ background: "var(--bg-3)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.max(2, pctOfMax)}%`,
                    background: step.color,
                    boxShadow: `0 0 8px ${step.color}40`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="pt-2 border-t flex items-center justify-between text-[11px] b-mono"
        style={{ borderColor: "var(--border)", color: "var(--text-subtle)" }}
      >
        <span>End-to-End Delivery</span>
        <span className="flex items-center gap-1" style={{ color: "var(--success)" }}>
          <CheckCircle2 className="w-3 h-3" />
          {steps[0]?.value > 0 && steps[4]?.value > 0
            ? `${Math.round((steps[4].value / steps[0].value) * 100)}% sent/company`
            : "Live tracking"}
        </span>
      </div>
    </div>
  );
}
