"use client";

import React from "react";
import {
  Building2,
  Users,
  Mail,
  Send,
  Layers,
  MessageSquareReply,
  TrendingUp,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

export interface KpiData {
  companies: number;
  contacts: number;
  emailsFound: number;
  emailsSent: number;
  totalDrafts: number;
  replied: number;
  draftSuccessRate: number;
  emailFindRate: number;
  replyRate: number;
}

export interface GrowthData {
  companies: { change: number; text: string; positive: boolean | null };
  contacts: { change: number; text: string; positive: boolean | null };
  emailsFound: { change: number; text: string; positive: boolean | null };
  emailsSent: { change: number; text: string; positive: boolean | null };
  totalDrafts: { change: number; text: string; positive: boolean | null };
  replied: { change: number; text: string; positive: boolean | null };
}

interface SparklinePoint {
  contacts: number;
  emailsFound: number;
  drafts: number;
  sent: number;
}

interface Props {
  kpi: KpiData;
  growth: GrowthData;
  allTime: KpiData;
  range: string;
  sparklineData?: SparklinePoint[];
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 64;
  const height = 20;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(" L ")}`;

  return (
    <svg width={width} height={height} className="overflow-visible opacity-70">
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GrowthBadge({
  data,
}: {
  data?: { change: number; text: string; positive: boolean | null };
}) {
  if (!data || data.positive === null) {
    return (
      <span className="flex items-center text-[10px] b-mono text-[var(--text-subtle)]">
        <Minus className="w-2.5 h-2.5 mr-0.5" /> 0%
      </span>
    );
  }

  const isPositive = data.positive;
  return (
    <span
      className="flex items-center text-[10px] b-mono px-1 py-0.5 rounded font-medium"
      style={{
        color: isPositive ? "var(--success)" : "var(--error)",
        background: isPositive ? "rgba(74, 222, 128, 0.1)" : "rgba(248, 113, 113, 0.1)",
      }}
    >
      {isPositive ? (
        <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" />
      ) : (
        <ArrowDownRight className="w-2.5 h-2.5 mr-0.5" />
      )}
      {data.text}
    </span>
  );
}

export function KpiCards({ kpi, growth, allTime, range, sparklineData }: Props) {
  const cards = [
    {
      label: "Target Companies",
      value: kpi.companies.toLocaleString(),
      allTime: allTime.companies.toLocaleString(),
      growth: growth.companies,
      icon: Building2,
      accent: "#94a3b8",
      sub: "pipeline target profiles",
    },
    {
      label: "Discovered Contacts",
      value: kpi.contacts.toLocaleString(),
      allTime: allTime.contacts.toLocaleString(),
      growth: growth.contacts,
      icon: Users,
      accent: "#c084fc",
      spark: sparklineData?.map((d) => d.contacts),
    },
    {
      label: "Verified Emails",
      value: kpi.emailsFound.toLocaleString(),
      allTime: allTime.emailsFound.toLocaleString(),
      growth: growth.emailsFound,
      icon: Mail,
      accent: "#38bdf8",
      spark: sparklineData?.map((d) => d.emailsFound),
      sub: `${kpi.emailFindRate}% find success`,
    },
    {
      label: "Outreach Sent",
      value: kpi.emailsSent.toLocaleString(),
      allTime: allTime.emailsSent.toLocaleString(),
      growth: growth.emailsSent,
      icon: Send,
      accent: "#4ade80",
      spark: sparklineData?.map((d) => d.sent),
      sub: `${kpi.draftSuccessRate}% send conversion`,
    },
    {
      label: "AI Draft Pitches",
      value: kpi.totalDrafts.toLocaleString(),
      allTime: allTime.totalDrafts.toLocaleString(),
      growth: growth.totalDrafts,
      icon: Layers,
      accent: "#fbbf24",
      spark: sparklineData?.map((d) => d.drafts),
    },
    {
      label: "Prospect Replies",
      value: kpi.replied.toLocaleString(),
      allTime: allTime.replied.toLocaleString(),
      growth: growth.replied,
      icon: MessageSquareReply,
      accent: "#34d399",
      sub: `${kpi.replyRate}% response rate`,
    },
    {
      label: "Email Find Rate",
      value: `${kpi.emailFindRate}%`,
      allTime: `${allTime.emailFindRate}% all-time`,
      icon: Zap,
      accent: "#60a5fa",
      sub: "verified lookup accuracy",
    },
    {
      label: "Delivery Rate",
      value: `${kpi.draftSuccessRate}%`,
      allTime: `${allTime.draftSuccessRate}% all-time`,
      icon: TrendingUp,
      accent: "#a78bfa",
      sub: "drafts converted to sent",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={i}
            className="b-card p-4 flex flex-col justify-between transition-all group hover:border-[var(--border-2)]"
            style={{ borderRadius: "var(--radius)" }}
          >
            {/* Top row: Icon + Growth or Sparkline */}
            <div className="flex items-start justify-between gap-2">
              <div
                className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--bg-2)", color: card.accent }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                {card.spark && (
                  <div className="hidden sm:block">
                    <MiniSparkline data={card.spark} color={card.accent} />
                  </div>
                )}
                {card.growth && <GrowthBadge data={card.growth} />}
              </div>
            </div>

            {/* Middle: Number + Label */}
            <div className="mt-3">
              <div className="b-stat text-2xl" style={{ color: "var(--text)" }}>
                {card.value}
              </div>
              <div className="b-mono text-xs font-medium text-[var(--text-muted)] truncate">
                {card.label}
              </div>
            </div>

            {/* Bottom footnote: All-time or sub info */}
            <div
              className="mt-2.5 pt-2 border-t flex items-center justify-between text-[10px] b-mono"
              style={{ borderColor: "var(--border)", color: "var(--text-subtle)" }}
            >
              <span>{card.sub || `${range} count`}</span>
              <span className="truncate">Total: {card.allTime}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
