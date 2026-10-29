"use client";

import React from "react";
import { Users, Briefcase, Award, Code, UserCheck, Shield } from "lucide-react";

export interface RoleDistributionItem {
  role: string;
  label: string;
  count: number;
  percentage: number;
}

interface Props {
  data: RoleDistributionItem[];
}

const ROLE_ICONS: Record<string, React.ElementType> = {
  FOUNDER_EXEC: Award,
  ENGINEERING_LEAD: Shield,
  SOFTWARE_ENGINEER: Code,
  HR_RECRUITER: UserCheck,
  OTHER: Briefcase,
};

const ROLE_COLORS: Record<string, string> = {
  FOUNDER_EXEC: "#f59e0b",
  ENGINEERING_LEAD: "#a855f7",
  SOFTWARE_ENGINEER: "#38bdf8",
  HR_RECRUITER: "#ec4899",
  OTHER: "#71717a",
};

export function RoleDistributionChart({ data }: Props) {
  const totalCount = data.reduce((acc, r) => acc + r.count, 0);

  return (
    <div className="b-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="b-section-title flex items-center gap-2">
          <Users className="w-3.5 h-3.5" style={{ color: "var(--info)" }} />
          Audience & Role Distribution
        </div>
        <span className="b-mono" style={{ fontSize: "11px", color: "var(--text-subtle)" }}>
          {totalCount.toLocaleString()} Contacts
        </span>
      </div>

      {/* Segmented multi-color progress track */}
      {data.length > 0 && (
        <div className="h-2 rounded-full overflow-hidden flex gap-0.5 bg-[var(--bg-3)]">
          {data.map((item) => (
            <div
              key={item.role}
              className="h-full transition-all duration-300"
              style={{
                width: `${Math.max(1, item.percentage)}%`,
                background: ROLE_COLORS[item.role] || "#71717a",
              }}
              title={`${item.label}: ${item.count} (${item.percentage}%)`}
            />
          ))}
        </div>
      )}

      {/* Role list items */}
      <div className="space-y-2 pt-1">
        {data.map((item) => {
          const Icon = ROLE_ICONS[item.role] || Briefcase;
          const color = ROLE_COLORS[item.role] || "#71717a";

          return (
            <div
              key={item.role}
              className="flex items-center justify-between p-2 rounded transition-colors group"
              style={{ background: "var(--bg-2)", borderRadius: "var(--radius-sm)" }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}15`, color }}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate text-[var(--text)] group-hover:text-white transition-colors">
                    {item.label}
                  </div>
                  <div className="b-mono text-[10px]" style={{ color: "var(--text-subtle)" }}>
                    {item.percentage}% of audience
                  </div>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <span className="font-semibold text-xs tabular-nums text-[var(--text)]">
                  {item.count.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
