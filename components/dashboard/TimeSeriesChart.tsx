"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  Activity,
  Send,
  Mail,
  Users,
  Layers,
  BarChart2,
  TrendingUp,
  LineChart as LineChartIcon,
  Maximize2,
} from "lucide-react";

export interface TimeSeriesPoint {
  timestamp: string;
  label: string;
  fullDate: string;
  contacts: number;
  emailsFound: number;
  drafts: number;
  sent: number;
  replied: number;
  totalActivity: number;
}

interface Props {
  data: TimeSeriesPoint[];
  range: "daily" | "weekly" | "monthly" | "all";
}

type MetricKey = "totalActivity" | "sent" | "emailsFound" | "contacts" | "drafts";

interface MetricConfig {
  key: MetricKey;
  label: string;
  color: string;
  gradientStart: string;
  gradientEnd: string;
  icon: React.ElementType;
}

const METRICS: MetricConfig[] = [
  {
    key: "totalActivity",
    label: "All Activity",
    color: "#e8e5df",
    gradientStart: "rgba(232, 229, 223, 0.25)",
    gradientEnd: "rgba(232, 229, 223, 0.0)",
    icon: Activity,
  },
  {
    key: "sent",
    label: "Emails Sent",
    color: "#4ade80",
    gradientStart: "rgba(74, 222, 128, 0.3)",
    gradientEnd: "rgba(74, 222, 128, 0.0)",
    icon: Send,
  },
  {
    key: "emailsFound",
    label: "Emails Found",
    color: "#38bdf8",
    gradientStart: "rgba(56, 189, 248, 0.3)",
    gradientEnd: "rgba(56, 189, 248, 0.0)",
    icon: Mail,
  },
  {
    key: "contacts",
    label: "Contacts",
    color: "#c084fc",
    gradientStart: "rgba(192, 132, 252, 0.3)",
    gradientEnd: "rgba(192, 132, 252, 0.0)",
    icon: Users,
  },
  {
    key: "drafts",
    label: "Drafts Created",
    color: "#fbbf24",
    gradientStart: "rgba(251, 191, 36, 0.3)",
    gradientEnd: "rgba(251, 191, 36, 0.0)",
    icon: Layers,
  },
];

// Helper to generate smooth cubic Bezier curve path
function getCurvedPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function TimeSeriesChart({ data, range }: Props) {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("totalActivity");
  const [chartType, setChartType] = useState<"area" | "bar">("area");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeMetric = METRICS.find((m) => m.key === selectedMetric) || METRICS[0];

  // SVG dimensions
  const width = 840;
  const height = 260;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 25;
  const padBottom = 35;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  // Compute maximums for scaling
  const maxVal = useMemo(() => {
    if (!data || data.length === 0) return 10;
    const values = data.map((d) => (selectedMetric === "totalActivity" ? d.totalActivity : d[selectedMetric]));
    const max = Math.max(...values, 0);
    return max <= 0 ? 5 : Math.ceil(max * 1.15);
  }, [data, selectedMetric]);

  // Points mapping
  const points = useMemo(() => {
    if (!data || data.length === 0) return [];
    const count = data.length;
    return data.map((d, i) => {
      const x = padLeft + (count === 1 ? plotWidth / 2 : (i / (count - 1)) * plotWidth);
      const val = selectedMetric === "totalActivity" ? d.totalActivity : d[selectedMetric];
      const y = padTop + plotHeight - (val / Math.max(1, maxVal)) * plotHeight;
      return { x, y, val, item: d };
    });
  }, [data, selectedMetric, maxVal, plotWidth, plotHeight]);

  // Area path
  const areaPath = useMemo(() => {
    if (points.length < 2) return "";
    const lineD = getCurvedPath(points);
    const lastX = points[points.length - 1].x;
    const firstX = points[0].x;
    const bottomY = padTop + plotHeight;
    return `${lineD} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;
  }, [points, padTop, plotHeight]);

  // Line path
  const linePath = useMemo(() => {
    return getCurvedPath(points);
  }, [points]);

  // Grid ticks
  const yTicks = useMemo(() => {
    const steps = 4;
    return Array.from({ length: steps + 1 }).map((_, i) => {
      const val = Math.round((maxVal / steps) * (steps - i));
      const y = padTop + (i / steps) * plotHeight;
      return { val, y };
    });
  }, [maxVal, padTop, plotHeight]);

  // X-axis label interval
  const xLabels = useMemo(() => {
    if (!data || data.length === 0) return [];
    const count = data.length;
    // Show between 5 and 8 labels evenly distributed
    const step = Math.max(1, Math.ceil(count / 7));
    return points.filter((_, idx) => idx % step === 0 || idx === count - 1);
  }, [data, points]);

  // Summary stats
  const totalVolume = useMemo(() => {
    if (!data) return 0;
    return data.reduce((acc, d) => acc + (selectedMetric === "totalActivity" ? d.totalActivity : d[selectedMetric]), 0);
  }, [data, selectedMetric]);

  const peakPoint = useMemo(() => {
    if (!data || data.length === 0) return null;
    let max = -1;
    let peakItem: TimeSeriesPoint | null = null;
    for (const d of data) {
      const val = selectedMetric === "totalActivity" ? d.totalActivity : d[selectedMetric];
      if (val > max) {
        max = val;
        peakItem = d;
      }
    }
    return peakItem && max > 0 ? { item: peakItem, val: max } : null;
  }, [data, selectedMetric]);

  // Handle mouse move for interactive inspection
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || points.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const relX = (mouseX / rect.width) * width;

    // Find closest point
    let closestIdx = 0;
    let minDiff = Infinity;
    points.forEach((p, idx) => {
      const diff = Math.abs(p.x - relX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    setHoverIndex(closestIdx);
  };

  const hoveredData = hoverIndex !== null && data[hoverIndex] ? data[hoverIndex] : null;
  const hoveredPoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : null;

  return (
    <div className="b-card p-5 space-y-4">
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="b-section-title flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" style={{ color: activeMetric.color }} />
              Outreach Activity Timeline
            </span>
            <span className="b-badge b-badge-info" style={{ textTransform: "capitalize" }}>
              {range} View
            </span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>
            Hover over the chart to inspect hourly/daily outreach volumes
          </div>
        </div>

        {/* Chart Style Switcher (Area vs Bar) */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div
            className="flex items-center p-0.5 rounded border"
            style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}
          >
            <button
              onClick={() => setChartType("area")}
              className="px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition-all"
              style={{
                background: chartType === "area" ? "var(--bg-1)" : "transparent",
                color: chartType === "area" ? "var(--text)" : "var(--text-subtle)",
                boxShadow: chartType === "area" ? "0 1px 3px rgba(0,0,0,0.4)" : "none",
              }}
              title="Curved Area Chart"
            >
              <LineChartIcon className="w-3 h-3" />
              <span>Area</span>
            </button>
            <button
              onClick={() => setChartType("bar")}
              className="px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition-all"
              style={{
                background: chartType === "bar" ? "var(--bg-1)" : "transparent",
                color: chartType === "bar" ? "var(--text)" : "var(--text-subtle)",
                boxShadow: chartType === "bar" ? "0 1px 3px rgba(0,0,0,0.4)" : "none",
              }}
              title="Bar Chart"
            >
              <BarChart2 className="w-3 h-3" />
              <span>Bar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric Selector Pills & Key Summary Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 pborder-t" style={{ borderColor: "var(--border)" }}>
        {/* Metric Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {METRICS.map((m) => {
            const isSelected = selectedMetric === m.key;
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                onClick={() => setSelectedMetric(m.key)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-all cursor-pointer"
                style={{
                  background: isSelected ? "var(--bg-2)" : "transparent",
                  color: isSelected ? "var(--text)" : "var(--text-subtle)",
                  border: `1px solid ${isSelected ? m.color : "transparent"}`,
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: m.color,
                    boxShadow: isSelected ? `0 0 6px ${m.color}` : "none",
                  }}
                />
                <Icon className="w-3 h-3" style={{ color: isSelected ? m.color : "inherit" }} />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Quick Insights summary */}
        <div className="flex items-center gap-4 text-xs b-mono">
          <div>
            <span style={{ color: "var(--text-subtle)" }}>Volume: </span>
            <span className="font-semibold" style={{ color: activeMetric.color }}>
              {totalVolume.toLocaleString()}
            </span>
          </div>
          {peakPoint && (
            <div className="hidden md:block">
              <span style={{ color: "var(--text-subtle)" }}>Peak: </span>
              <span style={{ color: "var(--text)" }}>
                {peakPoint.val} ({peakPoint.item.label})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden select-none"
        style={{ minHeight: "260px" }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            {/* Metric dynamic gradient */}
            <linearGradient id={`grad-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={activeMetric.gradientStart} />
              <stop offset="100%" stopColor={activeMetric.gradientEnd} />
            </linearGradient>

            {/* Subtle glow filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background horizontal grid lines */}
          {yTicks.map((t, idx) => (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={t.y}
                x2={width - padRight}
                y2={t.y}
                stroke="var(--border)"
                strokeDasharray={idx === yTicks.length - 1 ? "none" : "3 3"}
                strokeOpacity={idx === yTicks.length - 1 ? 0.7 : 0.4}
              />
              <text
                x={padLeft - 8}
                y={t.y + 3}
                textAnchor="end"
                fontSize="10"
                fill="var(--text-subtle)"
                fontFamily="'IBM Plex Mono', monospace"
              >
                {t.val}
              </text>
            </g>
          ))}

          {/* Chart Content: Area or Bar */}
          {chartType === "area" ? (
            <>
              {/* Filled area below curve */}
              {areaPath && (
                <path
                  d={areaPath}
                  fill={`url(#grad-${selectedMetric})`}
                  className="transition-all duration-300"
                />
              )}

              {/* Main curve line */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke={activeMetric.color}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#glow)"
                  className="transition-all duration-300"
                />
              )}

              {/* Data points (subtle dots) */}
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={hoverIndex === i ? 5 : p.val > 0 ? 2.5 : 1}
                  fill={hoverIndex === i ? "#ffffff" : activeMetric.color}
                  stroke="var(--bg-1)"
                  strokeWidth={hoverIndex === i ? 2 : 1}
                  className="transition-all duration-150"
                  style={{
                    filter: hoverIndex === i ? `drop-shadow(0 0 6px ${activeMetric.color})` : "none",
                  }}
                />
              ))}
            </>
          ) : (
            /* Bar Chart mode */
            <g>
              {points.map((p, i) => {
                const barWidth = Math.max(4, Math.min(24, (plotWidth / points.length) * 0.65));
                const barHeight = Math.max(0, padTop + plotHeight - p.y);
                const isHovered = hoverIndex === i;
                return (
                  <rect
                    key={i}
                    x={p.x - barWidth / 2}
                    y={p.y}
                    width={barWidth}
                    height={barHeight}
                    rx="2"
                    fill={isHovered ? "#ffffff" : activeMetric.color}
                    opacity={isHovered ? 1 : 0.75}
                    className="transition-all duration-150"
                    style={{
                      filter: isHovered ? `drop-shadow(0 0 8px ${activeMetric.color})` : "none",
                    }}
                  />
                );
              })}
            </g>
          )}

          {/* Interactive Crosshair & Cursor Line */}
          {hoveredPoint && (
            <g>
              {/* Vertical dotted crosshair */}
              <line
                x1={hoveredPoint.x}
                y1={padTop}
                x2={hoveredPoint.x}
                y2={padTop + plotHeight}
                stroke="var(--text-subtle)"
                strokeDasharray="3 3"
                strokeWidth="1"
              />

              {/* Highlighting pulsating ring */}
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="7"
                fill="none"
                stroke={activeMetric.color}
                strokeWidth="1.5"
                opacity="0.8"
              />
            </g>
          )}

          {/* X-axis labels */}
          {xLabels.map((p, idx) => (
            <text
              key={idx}
              x={p.x}
              y={padTop + plotHeight + 18}
              textAnchor="middle"
              fontSize="10"
              fill="var(--text-subtle)"
              fontFamily="'IBM Plex Mono', monospace"
            >
              {p.item.label}
            </text>
          ))}
        </svg>

        {/* Floating Tooltip Card */}
        {hoveredData && hoveredPoint && (
          <div
            className="absolute pointer-events-none z-30 transform -translate-x-1/2 transition-transform duration-75"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: Math.max(10, Math.min(180, (hoveredPoint.y / height) * 260 - 110)),
            }}
          >
            <div
              className="p-3 rounded shadow-xl border text-xs space-y-2 backdrop-blur-md"
              style={{
                background: "rgba(18, 18, 18, 0.94)",
                borderColor: "var(--border-2)",
                minWidth: "170px",
                borderRadius: "var(--radius)",
              }}
            >
              <div className="border-b pb-1.5 flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                <span className="font-semibold" style={{ color: "var(--text)" }}>
                  {hoveredData.fullDate}
                </span>
                <span className="b-mono" style={{ color: "var(--text-subtle)", fontSize: "10px" }}>
                  {hoveredData.label}
                </span>
              </div>

              {/* Rows */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#4ade80" }} />
                    Sent
                  </span>
                  <span className="font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                    {hoveredData.sent}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#38bdf8" }} />
                    Emails Found
                  </span>
                  <span className="font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                    {hoveredData.emailsFound}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#c084fc" }} />
                    Contacts
                  </span>
                  <span className="font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                    {hoveredData.contacts}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#fbbf24" }} />
                    Drafts
                  </span>
                  <span className="font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                    {hoveredData.drafts}
                  </span>
                </div>
              </div>

              {/* Total activity footer */}
              <div
                className="pt-1.5 border-t flex items-center justify-between font-medium"
                style={{ borderColor: "var(--border)", color: "var(--text)" }}
              >
                <span>Total Activity</span>
                <span className="b-mono">{hoveredData.totalActivity}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Empty State warning if total volume is 0 */}
      {totalVolume === 0 && (
        <div
          className="text-center py-6 px-4 rounded border text-xs b-mono"
          style={{ background: "var(--bg-2)", borderColor: "var(--border)", color: "var(--text-subtle)" }}
        >
          No outreach activities recorded for this {range} interval yet. Start a new company pipeline to generate data!
        </div>
      )}
    </div>
  );
}
