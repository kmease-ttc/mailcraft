import type { CsvRow, JiraQueryResult } from "@shared/types";
import { REPORT_QUERY_IDS } from "@shared/reportManifest";

/* ── helpers ─────────────────────────────────────────────────── */

/** Format a number to at most 1 decimal place, never repeating decimals */
function fmt(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

/** Group rows by month (YYYY-MM) using a date column */
function groupByMonth(rows: CsvRow[], dateCol: string): Map<string, CsvRow[]> {
  const map = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const d = row[dateCol];
    const month = d ? d.slice(0, 7) : "Unknown";
    if (!map.has(month)) map.set(month, []);
    map.get(month)!.push(row);
  }
  return new Map([...map.entries()].sort());
}

/** Group rows by a field and count */
function countBy(rows: CsvRow[], field: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const val = row[field] || "Unknown";
    map.set(val, (map.get(val) || 0) + 1);
  }
  return new Map([...map.entries()].sort((a, b) => b[1] - a[1]));
}

/** Sum a numeric field grouped by another field */
function sumBy(rows: CsvRow[], groupField: string, sumField: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = row[groupField] || "Unknown";
    const val = parseFloat(row[sumField]) || 0;
    map.set(key, (map.get(key) || 0) + val);
  }
  return map;
}

/* ── issue type system ──────────────────────────────────────── */

const ISSUE_TYPE_COLORS: Record<string, string> = {
  initiative: "#1e40af",
  epic: "#7c3aed",
  story: "#007eb4",
  task: "#0891b2",
  bug: "#dc2626",
  "sub-task": "#64748b",
  subtask: "#64748b",
  incident: "#ea580c",
  research: "#059669",
  "test execution": "#0284c7",
  spike: "#059669",
};

const ISSUE_TYPE_ORDER: string[] = [
  "initiative", "epic", "story", "task", "bug", "incident",
  "research", "spike", "sub-task", "subtask", "test execution",
];

function typeColor(issueType: string): string {
  return ISSUE_TYPE_COLORS[issueType.toLowerCase()] || "#94a3b8";
}

function typeSort(a: string, b: string): number {
  const ai = ISSUE_TYPE_ORDER.indexOf(a.toLowerCase());
  const bi = ISSUE_TYPE_ORDER.indexOf(b.toLowerCase());
  return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
}

/* ── grading system ─────────────────────────────────────────── */

function gradeFor(score: number): { letter: string; color: string } {
  if (score >= 90) return { letter: "A", color: "#16a34a" };
  if (score >= 80) return { letter: "B", color: "#22c55e" };
  if (score >= 70) return { letter: "C", color: "#eab308" };
  if (score >= 60) return { letter: "D", color: "#f97316" };
  return { letter: "F", color: "#dc2626" };
}

function gradeBadge(score: number): string {
  const { letter, color } = gradeFor(score);
  return `<span style="display:inline-block;background:${color};color:#fff;font-size:12px;font-weight:800;width:24px;height:24px;line-height:24px;text-align:center;border-radius:6px;float:right;">${letter}</span>`;
}

/* ── priority helpers ───────────────────────────────────────── */

const CRITICAL_PRIORITIES = new Set([
  "highest", "high", "blocker", "critical",
  "p0", "p1", "sev-0", "sev-1", "sub-0", "sub-1",
  "sub0", "sub1",
]);

function isCritical(row: CsvRow): boolean {
  const p = (row["Priority"] || "").toLowerCase().trim();
  return CRITICAL_PRIORITIES.has(p);
}

/* ── chart primitives ───────────────────────────────────────── */

/** Column chart — fits within email width via table-layout:fixed */
function columnChart(
  data: Map<string, number>,
  color = "#009add",
  suffix = ""
): string {
  const max = Math.max(...data.values(), 1);
  const entries = [...data.entries()];
  if (entries.length === 0) return "";

  const cols = entries
    .map(
      ([, count]) => `
      <td style="vertical-align:bottom;text-align:center;padding:0 1px;">
        <div style="font-size:9px;font-weight:700;color:#0f172a;margin-bottom:2px;">${fmt(count)}${suffix}</div>
        <div style="background:${color};height:${Math.max(Math.round((count / max) * 100), 4)}px;border-radius:4px 4px 0 0;margin:0 auto;min-width:8px;"></div>
      </td>`
    )
    .join("");

  const labels = entries
    .map(
      ([label]) =>
        `<td style="text-align:center;padding:3px 1px 0;font-size:8px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;max-width:0;">${label}</td>`
    )
    .join("");

  return `<table style="border-collapse:collapse;width:100%;margin:8px 0;table-layout:fixed;">
    <tr>${cols}</tr>
    <tr style="border-top:1px solid #e2e8f0;">${labels}</tr>
  </table>`;
}

/** Monthly trend column chart */
function monthlyTrendChart(
  rows: CsvRow[],
  dateCol: string,
  color = "#009add"
): string {
  const byMonth = groupByMonth(rows, dateCol);
  if (byMonth.size === 0) return "";

  const data = new Map<string, number>();
  for (const [month, items] of byMonth) {
    if (month === "Unknown") continue;
    const d = new Date(month + "-01");
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    data.set(label, items.length);
  }

  return columnChart(data, color);
}

/** Compact data table */
function dataTable(
  rows: CsvRow[],
  columns: string[],
  maxRows = 10
): string {
  if (!rows.length) return "";

  const display = rows.slice(0, maxRows);
  const ths = columns
    .map(
      (c) =>
        `<th style="background:#044d66;color:#fff;padding:8px 10px;text-align:left;font-size:11px;font-weight:600;">${c}</th>`
    )
    .join("");

  const trs = display
    .map(
      (row, i) =>
        `<tr>${columns
          .map(
            (c) =>
              `<td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#334155;${i % 2 ? "background:#f8fafc;" : ""}">${row[c] || ""}</td>`
          )
          .join("")}</tr>`
    )
    .join("");

  let html = `<table style="border-collapse:collapse;width:100%;margin:8px 0;border-radius:8px;overflow:hidden;"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;

  if (rows.length > maxRows) {
    html += `<p style="color:#94a3b8;font-size:10px;">Showing ${maxRows} of ${rows.length}.</p>`;
  }
  return html;
}

const DONE_STATUSES = new Set(["done", "closed", "cancelled", "cancel", "resolved"]);

function isDone(row: CsvRow): boolean {
  const s = (row["Status"] || "").toLowerCase().trim();
  return DONE_STATUSES.has(s);
}

function criticalItemsTable(rows: CsvRow[], columns: string[]): string {
  const critical = rows.filter((r) => isCritical(r) && !isDone(r));
  if (critical.length === 0) return "";

  return `
    <p style="margin:8px 0 4px;font-size:12px;font-weight:600;color:#dc2626;">&#9888; ${critical.length} open critical item${critical.length > 1 ? "s" : ""}</p>
    ${dataTable(critical, columns, 10)}`;
}

/* ── date helpers ────────────────────────────────────────────── */

function getMonthKeys(): { current: string; prior: string } {
  const now = new Date();
  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const pri = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  return { current: cur, prior: pri };
}

function countForMonth(rows: CsvRow[], dateCol: string, monthKey: string): number {
  return rows.filter((r) => (r[dateCol] || "").startsWith(monthKey)).length;
}

interface TrendInfo {
  currentVal: number;
  priorVal: number;
  delta: number;
  pctChange: string;
  direction: "up" | "down" | "flat";
  isGood: boolean;
}

function computeTrend(
  rows: CsvRow[],
  dateCol: string,
  upIsGood: boolean
): TrendInfo {
  const { current, prior } = getMonthKeys();
  const curCount = countForMonth(rows, dateCol, current);
  const priCount = countForMonth(rows, dateCol, prior);
  const delta = curCount - priCount;
  const direction: "up" | "down" | "flat" = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const pctChange =
    priCount > 0
      ? Math.abs(Math.round((delta / priCount) * 100)) + "%"
      : curCount > 0
        ? "new"
        : "—";
  const isGood =
    direction === "flat" ? true : upIsGood ? direction === "up" : direction === "down";

  return { currentVal: curCount, priorVal: priCount, delta, pctChange, direction, isGood };
}

/** Get last 6 month keys (YYYY-MM) */
function getLast6Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}

/** Email-safe sparkline bar chart */
function miniChart(values: number[], color: string): string {
  if (values.length < 2 || values.every(v => v === 0)) return "";
  const max = Math.max(...values, 1);
  const barW = Math.max(6, Math.floor(56 / values.length));
  const bars = values.map((v, i) => {
    const h = Math.max(2, Math.round((v / max) * 28));
    const isLast = i === values.length - 1;
    return `<td style="vertical-align:bottom;padding:0 1px;">
      <div style="width:${barW}px;height:${h}px;background:${color};opacity:${isLast ? "1" : "0.35"};border-radius:2px 2px 0 0;"></div>
    </td>`;
  }).join("");
  return `<table style="border-collapse:collapse;"><tr>${bars}</tr></table>`;
}

/* ── layout primitives ───────────────────────────────────────── */

/** KPI metric card with optional sparkline and accent bar */
function metricBox(
  value: string | number,
  label: string,
  trend?: TrendInfo,
  priorVal?: string | number,
  sparkData?: number[],
  accentColor?: string
): string {
  const accent = accentColor || "#009add";

  let trendHtml = "";
  if (trend && trend.direction !== "flat") {
    const arrow = trend.direction === "up" ? "&uarr;" : "&darr;";
    const color = trend.isGood ? "#16a34a" : "#dc2626";
    const bg = trend.isGood ? "#ecfdf5" : "#fef2f2";
    trendHtml = `<span style="display:inline-block;font-size:10px;font-weight:600;color:${color};background:${bg};padding:2px 7px;border-radius:10px;">${arrow} ${fmt(Math.abs(trend.delta))}</span>`;
  } else if (trend) {
    trendHtml = `<span style="display:inline-block;font-size:10px;color:#cbd5e1;">&mdash; flat</span>`;
  }

  let priorHtml = "";
  if (priorVal !== undefined) {
    priorHtml = `<div style="font-size:9px;color:#94a3b8;margin-top:2px;">vs ${priorVal} prior mo</div>`;
  }

  const sparkHtml = sparkData ? miniChart(sparkData, accent) : "";

  return `<td style="width:33.33%;padding:4px;vertical-align:top;">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;height:100%;min-height:110px;">
      <div style="height:3px;background:${accent};"></div>
      <div style="padding:14px 14px 12px;">
        <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">${label}</div>
        <table style="border-collapse:collapse;width:100%;"><tr>
          <td style="vertical-align:top;padding:0;">
            <div style="font-size:28px;font-weight:800;color:#0f172a;line-height:1;">${value}</div>
            <div style="margin-top:5px;">${trendHtml}</div>
            ${priorHtml}
          </td>
          ${sparkHtml ? `<td style="vertical-align:bottom;padding:0;text-align:right;width:70px;">${sparkHtml}</td>` : ""}
        </tr></table>
      </div>
    </div>
  </td>`;
}

/** Pillar header */
function pillar(num: string, title: string, color: string, description: string, grade?: number): string {
  const gradeHtml = grade !== undefined ? gradeBadge(grade) : "";
  return `
  <div style="margin-top:32px;padding:14px 20px;background:#fff;border:1px solid #e2e8f0;border-left:4px solid ${color};border-radius:0 10px 10px 0;">
    <h2 style="margin:0;font-size:16px;font-weight:800;color:#0f172a;letter-spacing:-0.3px;">${gradeHtml}<span style="color:${color};margin-right:6px;">${num}</span>${title}</h2>
    <p style="margin:3px 0 0;font-size:11px;color:#94a3b8;">${description}</p>
  </div>`;
}

/** Metric sub-header */
function metric(title: string, summary: string, grade?: number): string {
  const gradeHtml = grade !== undefined ? gradeBadge(grade) : "";
  return `
  <div style="margin-top:18px;">
    <h4 style="margin:0 0 2px;font-size:13px;font-weight:700;color:#0f172a;">${gradeHtml}${title}</h4>
    <p style="margin:0 0 6px;font-size:11px;color:#94a3b8;">${summary}</p>
  </div>`;
}

/** Stacked percentage bar */
function stackedBar(segments: { label: string; pct: number; color: string }[]): string {
  const bars = segments
    .filter((s) => s.pct > 0)
    .map(
      (s) =>
        `<div style="background:${s.color};width:${s.pct}%;display:flex;align-items:center;justify-content:center;padding:0 4px;min-width:${s.pct > 5 ? 0 : 28}px;">
          <span style="color:#fff;font-size:9px;font-weight:600;white-space:nowrap;">${s.label} ${fmt(s.pct)}%</span>
        </div>`
    )
    .join("");
  return `<div style="display:flex;height:24px;border-radius:6px;overflow:hidden;margin:8px 0;gap:1px;">${bars}</div>`;
}

/** Issue type distribution — clean color bar (no labels in bar) + legend below */
function typeDistributionBar(typeCounts: Map<string, number>): string {
  const total = [...typeCounts.values()].reduce((s, n) => s + n, 0) || 1;
  const sorted = [...typeCounts.entries()].sort((a, b) => typeSort(a[0], b[0]));

  // Color-only bar — no text overlaid
  const bars = sorted
    .filter(([, count]) => (count / total) * 100 > 0)
    .map(([type, count]) => {
      const pct = (count / total) * 100;
      return `<div style="background:${typeColor(type)};width:${pct}%;min-width:3px;"></div>`;
    })
    .join("");

  const barHtml = `<div style="display:flex;height:22px;border-radius:6px;overflow:hidden;margin:6px 0;gap:1px;">${bars}</div>`;

  const legendItems = sorted
    .map(([type, count]) =>
      `<span style="display:inline-block;margin-right:10px;font-size:10px;color:#64748b;white-space:nowrap;"><span style="display:inline-block;width:7px;height:7px;border-radius:2px;background:${typeColor(type)};margin-right:3px;vertical-align:middle;"></span>${type} ${count} <span style="color:#94a3b8;">(${fmt((count / total) * 100)}%)</span></span>`
    )
    .join("");

  return `${barHtml}<div style="margin:3px 0 6px;line-height:1.7;">${legendItems}</div>`;
}

/** Stage card — single metric with accent top border */
function stageCard(label: string, count: number, color: string, sublabel?: string): string {
  return `<td style="width:25%;padding:0 4px;">
    <div style="background:#fff;border:1px solid #e2e8f0;border-top:3px solid ${color};border-radius:10px;padding:14px 8px;text-align:center;">
      <div style="font-size:26px;font-weight:800;color:${color};line-height:1;">${count}</div>
      <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">${label}</div>
      ${sublabel ? `<div style="font-size:9px;color:#94a3b8;margin-top:2px;">${sublabel}</div>` : ""}
    </div>
  </td>`;
}

/** Doing Well / Areas for Improvement */
function insights(good: string[], improve: string[]): string {
  const goodLi = (text: string) =>
    `<li style="margin:3px 0;font-size:11px;line-height:1.5;list-style:none;padding-left:0;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#16a34a;margin-right:7px;vertical-align:middle;"></span>${text}</li>`;
  const improveLi = (text: string) =>
    `<li style="margin:3px 0;font-size:11px;line-height:1.5;list-style:none;padding-left:0;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#f59e0b;margin-right:7px;vertical-align:middle;"></span>${text}</li>`;

  const goodHtml = good.length
    ? `<div style="flex:1;min-width:180px;">
        <div style="font-size:11px;font-weight:700;color:#16a34a;margin-bottom:4px;">&#10003; Doing Well</div>
        <ul style="margin:0;padding-left:0;color:#334155;">${good.map(goodLi).join("")}</ul>
      </div>`
    : "";

  const improveHtml = improve.length
    ? `<div style="flex:1;min-width:180px;">
        <div style="font-size:11px;font-weight:700;color:#f59e0b;margin-bottom:4px;">&#9888; Improve</div>
        <ul style="margin:0;padding-left:0;color:#334155;">${improve.map(improveLi).join("")}</ul>
      </div>`
    : "";

  if (!goodHtml && !improveHtml) return "";

  return `<div style="display:flex;gap:16px;margin:14px 0 8px;padding:12px 16px;background:#f8fafc;border-radius:10px;border:1px solid #f1f5f9;">
    ${goodHtml}${improveHtml}
  </div>`;
}

/* ── main report builder ─────────────────────────────────────── */

export function buildFullReport(
  results: JiraQueryResult[]
): string {
  const resultIds = new Set(results.map((r) => r.queryId));
  const missing = REPORT_QUERY_IDS.filter((id) => !resultIds.has(id));
  if (missing.length > 0) {
    console.warn(
      `[reportBuilder] Missing query results for: ${missing.join(", ")}. Report may be incomplete.`
    );
  }

  const find = (id: string) => results.find((r) => r.queryId === id);

  const throughput = find("throughput");
  const velocity = find("velocity");
  const cycleTime = find("cycle_time");
  const wip = find("wip");
  const backlog = find("backlog_readiness");
  const allBugs = find("all_bugs");
  const prodBugs = find("prod_bugs");
  const regressions = find("regressions");
  const rework = find("rework");
  const unplanned = find("unplanned_work");
  const discovery = find("discovery");
  const blocked = find("blocked");
  const stageDist = find("stage_distribution");

  // Derived metrics
  const totalCompleted = throughput?.issueCount || 0;
  const totalBugs = allBugs?.issueCount || 0;
  const defectDensity =
    totalCompleted > 0 ? fmt((totalBugs / totalCompleted) * 100) : "N/A";
  const unplannedCount = unplanned?.issueCount || 0;
  const unplannedRatio =
    totalCompleted > 0 ? fmt((unplannedCount / totalCompleted) * 100) : "N/A";

  const isStory = (r: CsvRow) => (r["Issue Type"] || "").toLowerCase() === "story";
  const storiesCompleted = throughput ? throughput.rows.filter(isStory).length : 0;
  const storiesInProgress = wip ? wip.rows.filter(isStory).length : 0;

  const { current: curMonth, prior: priorMonth } = getMonthKeys();
  const curMonthLabel = new Date(curMonth + "-01").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const ptsThisMonth = velocity
    ? velocity.rows
        .filter((r) => (r["Resolved"] || "").startsWith(curMonth))
        .reduce((s, r) => s + (parseFloat(r["Story Points"]) || 0), 0)
    : 0;
  const ptsPriorMonth = velocity
    ? velocity.rows
        .filter((r) => (r["Resolved"] || "").startsWith(priorMonth))
        .reduce((s, r) => s + (parseFloat(r["Story Points"]) || 0), 0)
    : 0;
  const ptsDelta = ptsThisMonth - ptsPriorMonth;
  const ptsTrend: TrendInfo = {
    currentVal: ptsThisMonth,
    priorVal: ptsPriorMonth,
    delta: ptsDelta,
    pctChange: ptsPriorMonth > 0 ? Math.abs(Math.round((ptsDelta / ptsPriorMonth) * 100)) + "%" : ptsThisMonth > 0 ? "new" : "—",
    direction: ptsDelta > 0 ? "up" : ptsDelta < 0 ? "down" : "flat",
    isGood: ptsDelta >= 0,
  };

  const storiesThisMonth = throughput
    ? throughput.rows.filter((r) => isStory(r) && (r["Resolved"] || "").startsWith(curMonth)).length
    : 0;
  const storiesPriorMonth = throughput
    ? throughput.rows.filter((r) => isStory(r) && (r["Resolved"] || "").startsWith(priorMonth)).length
    : 0;
  const storiesDelta = storiesThisMonth - storiesPriorMonth;
  const storiesTrend: TrendInfo = {
    currentVal: storiesThisMonth,
    priorVal: storiesPriorMonth,
    delta: storiesDelta,
    pctChange: storiesPriorMonth > 0 ? Math.abs(Math.round((storiesDelta / storiesPriorMonth) * 100)) + "%" : storiesThisMonth > 0 ? "new" : "—",
    direction: storiesDelta > 0 ? "up" : storiesDelta < 0 ? "down" : "flat",
    isGood: storiesDelta >= 0,
  };

  const bugsTrend = allBugs ? computeTrend(allBugs.rows, "Created", false) : undefined;
  const unplannedTrend = unplanned ? computeTrend(unplanned.rows, "Resolved", false) : undefined;
  const reworkTrend = rework ? computeTrend(rework.rows, "Updated", false) : undefined;

  // Defect density trend
  const lastMonthCompleted = throughput
    ? throughput.rows.filter((r) => (r["Resolved"] || "").startsWith(curMonth)).length
    : 0;
  const lastMonthBugs = bugsTrend?.currentVal || 0;
  const lastMonthDensity =
    lastMonthCompleted > 0 ? fmt((lastMonthBugs / lastMonthCompleted) * 100) : "N/A";
  const priorMonthCompleted = throughput
    ? throughput.rows.filter((r) => (r["Resolved"] || "").startsWith(priorMonth)).length
    : 0;
  const priorMonthBugs = bugsTrend?.priorVal || 0;
  const priorMonthDensity =
    priorMonthCompleted > 0 ? (priorMonthBugs / priorMonthCompleted) * 100 : 0;
  const curDensityNum = lastMonthCompleted > 0 ? (lastMonthBugs / lastMonthCompleted) * 100 : 0;
  const densityDelta = curDensityNum - priorMonthDensity;
  const densityTrend: TrendInfo = {
    currentVal: curDensityNum,
    priorVal: priorMonthDensity,
    delta: Math.round(densityDelta * 10) / 10,
    pctChange: fmt(Math.abs(Math.round(densityDelta * 10) / 10)) + "pp",
    direction: densityDelta > 0.5 ? "up" : densityDelta < -0.5 ? "down" : "flat",
    isGood: densityDelta <= 0,
  };

  // Sparkline data — last 6 months
  const last6 = getLast6Months();
  const velocityByMonth = groupByMonth(velocity?.rows || [], "Resolved");
  const throughputByMonth = groupByMonth(throughput?.rows || [], "Resolved");
  const storiesByMonthMap = groupByMonth(
    (throughput?.rows || []).filter(isStory), "Resolved"
  );
  const bugsByMonthMap = groupByMonth(allBugs?.rows || [], "Created");
  const unplannedByMonthMap = groupByMonth(unplanned?.rows || [], "Resolved");

  const ptsSpark = last6.map(m =>
    (velocityByMonth.get(m) || []).reduce((s, r) => s + (parseFloat(r["Story Points"]) || 0), 0)
  );
  const storiesSpark = last6.map(m => (storiesByMonthMap.get(m) || []).length);
  const bugsSpark = last6.map(m => (bugsByMonthMap.get(m) || []).length);
  const unplannedSpark = last6.map(m => (unplannedByMonthMap.get(m) || []).length);
  const densitySpark = last6.map((m) => {
    const comp = (throughputByMonth.get(m) || []).length;
    const bugs = (bugsByMonthMap.get(m) || []).length;
    return comp > 0 ? Math.round((bugs / comp) * 100) : 0;
  });

  // Velocity per sprint (strip "Sprint" prefix)
  const sprintVelocity = velocity
    ? (() => {
        const raw = sumBy(velocity.rows, "Sprint", "Story Points");
        const entries = [...raw.entries()]
          .filter(([k]) => k !== "Unknown")
          .sort((a, b) => {
            const numA = parseInt(a[0].replace(/\D/g, ""));
            const numB = parseInt(b[0].replace(/\D/g, ""));
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a[0].localeCompare(b[0]);
          });
        const cleaned = entries.map(([label, val]) => {
          const stripped = label.replace(/sprint\s*/i, "").trim();
          return [stripped, Math.round(val * 10) / 10] as [string, number];
        });
        return new Map(cleaned);
      })()
    : new Map<string, number>();
  const totalPts = velocity
    ? velocity.rows.reduce((s, r) => s + (parseFloat(r["Story Points"]) || 0), 0)
    : 0;
  const avgVelocity =
    sprintVelocity.size > 0 ? Math.round(totalPts / sprintVelocity.size) : 0;

  // Work type distribution
  const typeBreakdown = throughput ? countBy(throughput.rows, "Issue Type") : new Map<string, number>();

  // Cycle time stats
  const cycleTimeDays: number[] = [];
  if (cycleTime) {
    for (const row of cycleTime.rows) {
      const ct = parseFloat(row["Cycle Time (days)"]) || parseFloat(row["Lead Time (days)"]);
      if (ct > 0) cycleTimeDays.push(ct);
    }
  }
  cycleTimeDays.sort((a, b) => a - b);
  const ctCount = cycleTimeDays.length;
  const ctAvg = ctCount > 0 ? Math.round(cycleTimeDays.reduce((s, v) => s + v, 0) / ctCount * 10) / 10 : 0;
  const ctMedian = ctCount > 0
    ? ctCount % 2 === 0
      ? Math.round((cycleTimeDays[ctCount / 2 - 1] + cycleTimeDays[ctCount / 2]) / 2 * 10) / 10
      : Math.round(cycleTimeDays[Math.floor(ctCount / 2)] * 10) / 10
    : 0;
  const ctP90 = ctCount > 0 ? Math.round(cycleTimeDays[Math.floor(ctCount * 0.9)] * 10) / 10 : 0;
  const ctMin = ctCount > 0 ? Math.round(cycleTimeDays[0] * 10) / 10 : 0;
  const ctMax = ctCount > 0 ? Math.round(cycleTimeDays[ctCount - 1] * 10) / 10 : 0;
  const hasTrueCycleTime = cycleTime
    ? cycleTime.rows.some((r) => parseFloat(r["Cycle Time (days)"]) > 0)
    : false;

  // Cycle time trend
  const ctThisMonthDays: number[] = [];
  const ctPriorMonthDays: number[] = [];
  if (cycleTime) {
    for (const row of cycleTime.rows) {
      const ct = parseFloat(row["Cycle Time (days)"]) || parseFloat(row["Lead Time (days)"]);
      if (ct <= 0) continue;
      const resolved = row["Resolved"] || "";
      if (resolved.startsWith(curMonth)) ctThisMonthDays.push(ct);
      if (resolved.startsWith(priorMonth)) ctPriorMonthDays.push(ct);
    }
  }
  ctThisMonthDays.sort((a, b) => a - b);
  ctPriorMonthDays.sort((a, b) => a - b);
  const medianOf = (arr: number[]) => {
    if (arr.length === 0) return 0;
    return arr.length % 2 === 0
      ? (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2
      : arr[Math.floor(arr.length / 2)];
  };
  const ctThisMedian = medianOf(ctThisMonthDays);
  const ctPriorMedian = medianOf(ctPriorMonthDays);
  const ctDelta = ctThisMedian - ctPriorMedian;
  const ctTrend: TrendInfo = {
    currentVal: ctThisMedian,
    priorVal: ctPriorMedian,
    delta: Math.round(ctDelta * 10) / 10,
    pctChange: ctPriorMedian > 0 ? Math.abs(Math.round((ctDelta / ctPriorMedian) * 100)) + "%" : "—",
    direction: ctDelta > 0.5 ? "up" : ctDelta < -0.5 ? "down" : "flat",
    isGood: ctDelta <= 0,
  };

  // Stage distribution — group all open items by status
  const stageMap = new Map<string, number>();
  if (stageDist) {
    for (const row of stageDist.rows) {
      const status = row["Status"] || "Unknown";
      stageMap.set(status, (stageMap.get(status) || 0) + 1);
    }
  }
  const totalOpenItems = stageDist?.issueCount || 0;

  // Velocity stability
  const sprintPtsArr = [...sprintVelocity.values()];
  const velocityStdDev = sprintPtsArr.length > 1
    ? Math.sqrt(sprintPtsArr.reduce((s, v) => s + (v - avgVelocity) ** 2, 0) / sprintPtsArr.length)
    : 0;
  const velocityCV = avgVelocity > 0 ? velocityStdDev / avgVelocity : 0;

  const wipCount = wip?.issueCount || 0;

  // Rates
  const escapeRate = totalCompleted > 0 ? ((prodBugs?.issueCount || 0) / totalCompleted * 100) : 0;
  const regressionRate = totalCompleted > 0 ? ((regressions?.issueCount || 0) / totalCompleted * 100) : 0;
  const reworkRate = totalCompleted > 0 ? ((rework?.issueCount || 0) / totalCompleted * 100) : 0;

  // ── Letter grades ──────────────────────────────────────────

  const deliveryScore = (() => {
    let score = 0;
    if (ptsTrend.direction === "up") score += 25; else if (ptsTrend.direction === "flat") score += 15; else score += 5;
    if (velocityCV < 0.25 && sprintPtsArr.length > 1) score += 25; else if (velocityCV < 0.4) score += 15; else score += 5;
    if (ctMedian > 0 && ctMedian <= 5) score += 25; else if (ctMedian <= 10) score += 20; else if (ctMedian <= 15) score += 15; else if (ctMedian <= 25) score += 10; else score += 5;
    if (storiesTrend.direction === "up") score += 25; else if (storiesTrend.direction === "flat") score += 15; else score += 5;
    return score;
  })();

  const qualityScore = (() => {
    let score = 0;
    const dd = parseFloat(defectDensity) || 0;
    if (dd < 5) score += 25; else if (dd < 10) score += 20; else if (dd < 15) score += 15; else if (dd < 20) score += 10; else score += 5;
    if (escapeRate === 0) score += 25; else if (escapeRate < 2) score += 20; else if (escapeRate < 5) score += 15; else if (escapeRate < 10) score += 10; else score += 5;
    const regCount = regressions?.issueCount || 0;
    if (regCount === 0) score += 25; else if (regCount <= 2) score += 20; else if (regCount <= 5) score += 15; else score += 5;
    const rwCount = rework?.issueCount || 0;
    if (rwCount === 0) score += 25; else if (rwCount <= 3) score += 20; else if (rwCount <= 6) score += 15; else score += 5;
    return score;
  })();

  const flowScore = (() => {
    let score = 0;
    if (wipCount <= 8) score += 33; else if (wipCount <= 15) score += 22; else score += 8;
    const up = parseFloat(unplannedRatio || "0");
    if (up < 10) score += 34; else if (up < 20) score += 25; else if (up < 30) score += 15; else score += 5;
    const bl = blocked?.issueCount || 0;
    if (bl === 0) score += 33; else if (bl <= 2) score += 22; else if (bl <= 5) score += 12; else score += 5;
    return score;
  })();

  // backlogScore computed below after pipeline velocity metrics

  // Individual metric grades
  const throughputGrade = (() => {
    let s = 0;
    if (ptsTrend.direction === "up") s += 50; else if (ptsTrend.direction === "flat") s += 35; else s += 15;
    if (storiesTrend.direction === "up") s += 50; else if (storiesTrend.direction === "flat") s += 35; else s += 15;
    return s;
  })();

  const velocityGrade = (() => {
    let s = 0;
    if (velocityCV < 0.25 && sprintPtsArr.length > 1) s += 50; else if (velocityCV < 0.4) s += 30; else s += 10;
    if (ptsTrend.direction === "up") s += 50; else if (ptsTrend.direction === "flat") s += 35; else s += 15;
    return s;
  })();

  const cycleTimeGrade = (() => {
    if (ctMedian <= 0) return 50;
    if (ctMedian <= 3) return 95;
    if (ctMedian <= 5) return 90;
    if (ctMedian <= 8) return 80;
    if (ctMedian <= 12) return 70;
    if (ctMedian <= 20) return 60;
    return 40;
  })();

  const defectDensityGrade = (() => {
    const dd = parseFloat(defectDensity) || 0;
    if (dd < 5) return 95; if (dd < 10) return 85; if (dd < 15) return 70; if (dd < 20) return 60; return 40;
  })();

  const escapeRateGrade = (() => {
    if (escapeRate === 0) return 95; if (escapeRate < 2) return 85; if (escapeRate < 5) return 70; if (escapeRate < 10) return 55; return 35;
  })();

  const regressionGrade = (() => {
    const c = regressions?.issueCount || 0;
    if (c === 0) return 95; if (c <= 2) return 80; if (c <= 5) return 65; return 40;
  })();

  const reworkGrade = (() => {
    const c = rework?.issueCount || 0;
    if (c === 0) return 95; if (c <= 3) return 80; if (c <= 6) return 65; return 40;
  })();

  // ── Pillar insights ──────────────────────────────────────────

  const deliveryGood: string[] = [];
  const deliveryImprove: string[] = [];

  if (ptsTrend.direction === "up") deliveryGood.push(`Story point output up ${ptsTrend.pctChange} month-over-month`);
  if (ptsTrend.direction === "down") deliveryImprove.push(`Story point output down ${ptsTrend.pctChange} from prior month`);
  if (storiesTrend.direction === "up") deliveryGood.push(`Stories completed trending up (${storiesThisMonth} vs ${storiesPriorMonth} prior)`);
  if (storiesTrend.direction === "down") deliveryImprove.push(`Fewer stories completed than prior month (${storiesThisMonth} vs ${storiesPriorMonth})`);
  if (velocityCV < 0.25 && sprintPtsArr.length > 1) deliveryGood.push(`Velocity is stable across sprints`);
  if (velocityCV >= 0.4 && sprintPtsArr.length > 1) deliveryImprove.push(`Velocity swings significantly — consider more consistent sprint planning`);
  if (avgVelocity > 0 && sprintPtsArr.length > 2) deliveryGood.push(`Averaging ${avgVelocity} pts/sprint across ${sprintVelocity.size} sprints`);

  const qualityGood: string[] = [];
  const qualityImprove: string[] = [];

  if ((prodBugs?.issueCount || 0) === 0) qualityGood.push("Zero production escapes");
  if ((prodBugs?.issueCount || 0) > 0) qualityImprove.push(`${prodBugs!.issueCount} bug${prodBugs!.issueCount > 1 ? "s" : ""} escaped to production`);
  if ((regressions?.issueCount || 0) === 0) qualityGood.push("No regressions detected");
  if ((regressions?.issueCount || 0) > 0) qualityImprove.push(`${regressions!.issueCount} regression${regressions!.issueCount > 1 ? "s" : ""} found`);
  if (bugsTrend && bugsTrend.direction === "down") qualityGood.push(`Bug filings trending down ${bugsTrend.pctChange}`);
  if (bugsTrend && bugsTrend.direction === "up") qualityImprove.push(`Bug filings up ${bugsTrend.pctChange} month-over-month`);
  if (parseFloat(defectDensity) < 10 && defectDensity !== "N/A") qualityGood.push(`Defect density at ${defectDensity}%`);
  if (parseFloat(defectDensity) >= 20) qualityImprove.push(`Defect density at ${defectDensity}% — 1 in 5 items is a bug`);
  if (reworkTrend && reworkTrend.direction === "down") qualityGood.push("Rework trending down");
  if (reworkTrend && reworkTrend.direction === "up") qualityImprove.push(`Rework up ${reworkTrend.pctChange}`);

  const flowGood: string[] = [];
  const flowImprove: string[] = [];

  if (wipCount <= 10) flowGood.push(`WIP at ${wipCount} — manageable`);
  if (wipCount > 15) flowImprove.push(`${wipCount} items in progress — consider WIP limits`);
  if (parseFloat(unplannedRatio || "0") < 15) flowGood.push(`Only ${unplannedRatio}% unplanned work`);
  if (parseFloat(unplannedRatio || "0") >= 30) flowImprove.push(`${unplannedRatio}% reactive work`);
  if ((blocked?.issueCount || 0) === 0) flowGood.push("No flagged impediments");
  if ((blocked?.issueCount || 0) > 3) flowImprove.push(`${blocked!.issueCount} items flagged as blocked`);

  // backlogGood/backlogImprove populated after pipeline velocity metrics below
  const backlogGood: string[] = [];
  const backlogImprove: string[] = [];

  // ── Backlog pipeline data ──────────────────────────────────
  const readyCount = backlog?.issueCount || 0;

  // Stage color map & pipeline grouping
  // Actual JIRA statuses: Future, Planning, Open, In Progress, In Development, Approval, Under Review, Ready for Testing, Ready for Development, Done, Cancel
  const SC: Record<string, string> = {
    "future": "#94a3b8",
    "planning": "#8b5cf6",
    "open": "#16a34a",
    "in progress": "#009add",
    "under review": "#a855f7",
    "ready for testing": "#f59e0b",
    "cancel": "#dc2626",
    // Fallbacks for generic status names
    "backlog": "#94a3b8", "new": "#94a3b8", "to do": "#94a3b8",
    "ready for development": "#16a34a", "ready for dev": "#16a34a", "ready": "#16a34a",
    "in development": "#009add", "developing": "#009add",
    "in review": "#a855f7", "code review": "#a855f7",
    "approval": "#a855f7",
    "in testing": "#f59e0b", "qa": "#f59e0b",
    "blocked": "#dc2626",
  };
  const gc = (s: string) => SC[s.toLowerCase()] || "#64748b";

  const DEV_STAGE_KEYS = new Set(["open", "in progress", "under review", "ready for testing", "ready for development", "ready for dev", "ready", "selected for development", "in development", "developing", "in review", "code review", "peer review", "in testing", "qa", "testing", "blocked", "approval"]);
  const PLANNING_STAGE_KEYS = new Set(["future", "planning", "backlog", "new", "to do", "discovery", "investigation", "research", "in design", "design", "groomed", "refined", "grooming"]);

  const devStageEntries = [...stageMap.entries()].filter(([s]) => DEV_STAGE_KEYS.has(s.toLowerCase())).sort((a, b) => b[1] - a[1]);
  const planningStageEntries = [...stageMap.entries()].filter(([s]) => PLANNING_STAGE_KEYS.has(s.toLowerCase())).sort((a, b) => b[1] - a[1]);
  const devStageTotal = devStageEntries.reduce((s, [, c]) => s + c, 0);
  const planningStageTotal = planningStageEntries.reduce((s, [, c]) => s + c, 0);

  // Pipeline velocity — monthly completion rate from throughput data
  const monthlyCompletionCounts = last6.map(m => (throughputByMonth.get(m) || []).length);
  const nonZeroMonths = monthlyCompletionCounts.filter(c => c > 0);
  const monthlyAvgCompletion = nonZeroMonths.length > 0
    ? Math.round(nonZeroMonths.reduce((s, v) => s + v, 0) / nonZeroMonths.length)
    : 0;
  const weeklyAvgCompletion = monthlyAvgCompletion > 0
    ? Math.round((monthlyAvgCompletion / 4.33) * 10) / 10
    : 0;
  const pipelineDepth = totalOpenItems;
  const weeksOfWork = weeklyAvgCompletion > 0
    ? Math.round((pipelineDepth / weeklyAvgCompletion) * 10) / 10
    : 0;

  const backlogScore = (() => {
    let score = 0;
    // Factor 1 (25pts): Ready items
    const ready = backlog?.issueCount || 0;
    if (ready >= 15) score += 25; else if (ready >= 10) score += 20; else if (ready >= 5) score += 15; else if (ready > 0) score += 8; else score += 3;
    // Factor 2 (25pts): Discovery pipeline
    const disc = discovery?.issueCount || 0;
    if (disc >= 5) score += 25; else if (disc >= 3) score += 20; else if (disc > 0) score += 15; else score += 5;
    // Factor 3 (25pts): Pipeline balance — dev vs planning
    const totalPipeline = devStageTotal + planningStageTotal;
    if (totalPipeline > 0) {
      const devRatio = devStageTotal / totalPipeline;
      if (devRatio >= 0.3 && devRatio <= 0.7) score += 25;
      else if (devRatio >= 0.2 && devRatio <= 0.8) score += 18;
      else score += 10;
    } else { score += 5; }
    // Factor 4 (25pts): Pipeline depth vs throughput
    if (weeksOfWork >= 4 && weeksOfWork <= 12) score += 25;
    else if (weeksOfWork >= 2 && weeksOfWork <= 16) score += 18;
    else if (weeksOfWork > 0) score += 10;
    else score += 5;
    return score;
  })();

  // ── Backlog insights (after pipeline velocity is computed) ──
  if ((backlog?.issueCount || 0) >= 10) backlogGood.push(`${backlog!.issueCount} items groomed and ready to pull`);
  else if ((backlog?.issueCount || 0) >= 5) backlogGood.push(`${backlog!.issueCount} items ready — adequate buffer`);
  if ((backlog?.issueCount || 0) > 0 && (backlog?.issueCount || 0) < 5) backlogImprove.push(`Only ${backlog!.issueCount} items ready — backlog may run dry`);
  if ((backlog?.issueCount || 0) === 0) backlogImprove.push("No groomed items ready to pull — schedule backlog refinement");
  if ((discovery?.issueCount || 0) > 0) backlogGood.push(`${discovery!.issueCount} open research/idea items in discovery pipeline`);
  if ((discovery?.issueCount || 0) === 0) backlogImprove.push("No discovery work in progress — consider adding research spikes");
  if (totalOpenItems > 0) backlogGood.push(`${totalOpenItems} total open items across ${stageMap.size} stages`);
  if (weeksOfWork >= 4 && weeksOfWork <= 12) backlogGood.push(`Pipeline runway at ${weeksOfWork} weeks — well-sized`);
  if (weeksOfWork > 12) backlogImprove.push(`${weeksOfWork} weeks of work in pipeline — consider prioritization review`);
  if (weeksOfWork > 0 && weeksOfWork < 3) backlogImprove.push(`Only ${weeksOfWork} weeks of work in pipeline — may need more grooming`);
  if (monthlyAvgCompletion > 0) backlogGood.push(`Completing ~${monthlyAvgCompletion} items/month on average`);

  // ── Executive summary highlights (top 3 each) ─────────────
  const topGood = [...deliveryGood, ...qualityGood, ...flowGood, ...backlogGood].slice(0, 3);
  const topImprove = [...deliveryImprove, ...qualityImprove, ...flowImprove, ...backlogImprove].slice(0, 3);

  const renderStageGroup = (entries: [string, number][]) => {
    if (entries.length === 0) return '<p style="color:#94a3b8;font-size:11px;">No items.</p>';
    const cards = entries.map(([status, count]) => {
      return stageCard(status, count, gc(status));
    });
    while (cards.length % 4 !== 0) cards.push('<td style="width:25%;padding:0 4px;"></td>');
    const trs: string[] = [];
    for (let i = 0; i < cards.length; i += 4) {
      trs.push("<tr>" + cards.slice(i, i + 4).join("") + "</tr>");
    }
    return '<table style="border-collapse:separate;border-spacing:6px 6px;width:100%;table-layout:fixed;margin:8px 0;">' + trs.join("") + "</table>";
  };

  /* ── HTML ───────────────────────────────────────────────────── */

  let html = `
<div style="font-family:'Work Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#051c2a;line-height:1.5;max-width:680px;margin:0 auto;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#051c2a 0%,#044d66 100%);color:#fff;padding:32px;border-radius:16px 16px 0 0;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="vertical-align:middle;">
          <img src="https://welcome.saas.mrisoftware.com/Content/images/MRI_Logo_RGB_Small.png" alt="MRI Software" style="height:36px;display:block;" />
        </td>
        <td style="vertical-align:middle;text-align:right;">
          <div style="font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.5);">SDLC Performance Report</div>
        </td>
      </tr>
    </table>
    <div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.1);">
      <p style="margin:0;opacity:0.6;font-size:13px;">LSCI &amp; LVAIRD &nbsp;&middot;&nbsp; 26 Weeks &nbsp;&middot;&nbsp; ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
    </div>
  </div>

  <!-- Body -->
  <div style="background:#fafbfc;padding:24px 24px 28px;border:1px solid #cbd6e2;border-top:none;border-radius:0 0 16px 16px;">

    <!-- ═══ EXECUTIVE SUMMARY ═══ -->
    <h2 style="margin:0 0 2px;font-size:17px;font-weight:800;letter-spacing:-0.3px;">Executive Summary</h2>
    <p style="margin:0 0 14px;font-size:11px;color:#94a3b8;">${curMonthLabel} vs prior &nbsp;&middot;&nbsp; <span style="color:#16a34a;">&uarr; good</span> &nbsp; <span style="color:#dc2626;">&darr; needs attention</span></p>

    <p style="margin:0 0 16px;font-size:12px;color:#475569;line-height:1.6;">Over 26 weeks: <strong>${totalCompleted} items</strong> completed (${storiesCompleted} stories, ${fmt(totalPts)} pts), defect density <strong>${defectDensity}%</strong>. ${parseFloat(unplannedRatio || "0") < 20 ? `Unplanned work low at ${unplannedRatio}%.` : `Unplanned work at ${unplannedRatio}% — worth monitoring.`} Backlog is clean.</p>

    <table style="border-collapse:separate;border-spacing:6px 0;width:100%;table-layout:fixed;margin:0 0 16px;">
      <tr>
      ${[
        { label: "Delivery", score: deliveryScore },
        { label: "Quality", score: qualityScore },
        { label: "Flow", score: flowScore },
        { label: "Backlog", score: backlogScore },
      ].map(({ label, score }) => {
        const { letter, color } = gradeFor(score);
        return `<td style="width:25%;padding:0;text-align:center;">
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px 4px 8px;">
            <div style="font-size:28px;font-weight:900;color:${color};line-height:1;">${letter}</div>
            <div style="font-size:9px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">${label}</div>
          </div>
        </td>`;
      }).join("")}
      </tr>
    </table>

    <table style="border-collapse:separate;border-spacing:0;width:100%;table-layout:fixed;margin-bottom:4px;">
      <tr>
      ${metricBox(fmt(ptsThisMonth), "Story Pts", ptsTrend, fmt(ptsPriorMonth), ptsSpark, "#009add")}
      ${metricBox(storiesThisMonth, "Stories Done", storiesTrend, storiesPriorMonth, storiesSpark, "#007eb4")}
      ${metricBox(storiesInProgress, "In Progress", undefined, undefined, undefined, "#0891b2")}
      </tr>
      <tr>
      ${metricBox(bugsTrend?.currentVal ?? totalBugs, "Bugs Filed", bugsTrend, bugsTrend?.priorVal, bugsSpark, "#dc2626")}
      ${metricBox(lastMonthDensity + "%", "Defect Density", densityTrend, undefined, densitySpark, "#e05252")}
      ${metricBox(unplannedTrend?.currentVal ?? unplannedCount, "Unplanned", unplannedTrend, unplannedTrend?.priorVal, unplannedSpark, "#f59e0b")}
      </tr>
    </table>

    <p style="font-size:10px;color:#cbd5e1;margin:8px 0 0;">26-week totals: ${totalCompleted} items &middot; ${storiesCompleted} stories &middot; ${fmt(totalPts)} pts &middot; ${totalBugs} bugs</p>

    ${insights(topGood, topImprove)}

    <!-- ═══ PILLAR I : DELIVERY ═══ -->
    ${pillar("I", "Delivery Performance", "#009add", "Output cadence, velocity, and cycle time.", deliveryScore)}

    ${metric("Throughput", `${totalCompleted} items completed — by type.`, throughputGrade)}
    ${typeDistributionBar(typeBreakdown)}
    <h4 style="margin:10px 0 2px;font-size:12px;font-weight:700;color:#475569;">Monthly Throughput</h4>
    ${throughput ? monthlyTrendChart(throughput.rows, "Resolved", "#009add") : ""}

    ${metric("Velocity", `${fmt(totalPts)} pts across ${sprintVelocity.size} sprints.`, velocityGrade)}
    ${sprintVelocity.size > 0 ? (() => {
      const stabilityLabel = velocityCV < 0.25 ? "Stable" : velocityCV < 0.4 ? "Moderate" : "Volatile";
      const stabilityColor = velocityCV < 0.25 ? "#16a34a" : velocityCV < 0.4 ? "#eab308" : "#dc2626";
      return `<table style="border-collapse:separate;border-spacing:6px 0;width:100%;table-layout:fixed;margin:8px 0;">
        <tr>
          <td style="text-align:center;padding:0;">
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 8px;">
              <div style="font-size:22px;font-weight:800;color:#007eb4;">${avgVelocity}</div>
              <div style="font-size:9px;color:#94a3b8;margin-top:2px;">Avg Pts/Sprint</div>
            </div>
          </td>
          <td style="text-align:center;padding:0;">
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 8px;">
              <div style="font-size:22px;font-weight:800;color:#007eb4;">${Math.round(velocityStdDev)}</div>
              <div style="font-size:9px;color:#94a3b8;margin-top:2px;">Std Dev</div>
            </div>
          </td>
          <td style="text-align:center;padding:0;">
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 8px;">
              <div style="font-size:22px;font-weight:800;color:${stabilityColor};">${stabilityLabel}</div>
              <div style="font-size:9px;color:#94a3b8;margin-top:2px;">Stability</div>
            </div>
          </td>
        </tr>
      </table>`;
    })() : ""}
    <h4 style="margin:10px 0 2px;font-size:12px;font-weight:700;color:#475569;">Points per Sprint</h4>
    ${sprintVelocity.size > 0 ? columnChart(sprintVelocity, "#007eb4") : '<p style="color:#94a3b8;font-size:11px;">No sprint data.</p>'}

    ${metric("Cycle Time", `${ctCount} items — ${hasTrueCycleTime ? "In Progress → Done" : "Created → Done (lead time)"}. All values in days.`, cycleTimeGrade)}
    ${ctCount > 0 ? `<table style="border-collapse:separate;border-spacing:6px 0;width:100%;table-layout:fixed;margin:8px 0;">
      <tr>
        <td style="width:25%;text-align:center;padding:0;">
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 6px;">
            <div style="font-size:22px;font-weight:800;color:#009add;">${fmt(ctAvg)}</div>
            <div style="font-size:9px;color:#94a3b8;margin-top:2px;">Avg (days)</div>
          </div>
        </td>
        <td style="width:25%;text-align:center;padding:0;">
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 6px;">
            <div style="font-size:22px;font-weight:800;color:#009add;">${fmt(ctMedian)}</div>
            <div style="font-size:9px;color:#94a3b8;margin-top:2px;">Median (days)</div>
            ${ctTrend.direction !== "flat" ? `<div style="margin-top:3px;"><span style="font-size:9px;font-weight:600;color:${ctTrend.isGood ? "#16a34a" : "#dc2626"};">${ctTrend.direction === "up" ? "&uarr;" : "&darr;"} ${fmt(Math.abs(ctTrend.delta))}d</span></div>` : ""}
          </div>
        </td>
        <td style="width:25%;text-align:center;padding:0;">
          <div style="background:${ctP90 > 20 ? "#fef2f2" : ctP90 > 10 ? "#fffbeb" : "#fff"};border:1px solid ${ctP90 > 20 ? "#fecaca" : ctP90 > 10 ? "#fde68a" : "#e2e8f0"};border-radius:10px;padding:14px 6px;">
            <div style="font-size:22px;font-weight:800;color:${ctP90 > 20 ? "#dc2626" : ctP90 > 10 ? "#eab308" : "#009add"};">${fmt(ctP90)}</div>
            <div style="font-size:9px;color:#94a3b8;margin-top:2px;">P90 (days)</div>
          </div>
        </td>
        <td style="width:25%;text-align:center;padding:0;">
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 6px;">
            <div style="font-size:22px;font-weight:800;color:#94a3b8;">${fmt(ctMin)}–${fmt(ctMax)}</div>
            <div style="font-size:9px;color:#94a3b8;margin-top:2px;">Range (days)</div>
          </div>
        </td>
      </tr>
    </table>
    <p style="font-size:10px;color:#94a3b8;margin:4px 0 0;line-height:1.4;">
      <strong style="color:#64748b;">P90:</strong> 90% of items finish within ${fmt(ctP90)} days. ${ctP90 > 20 ? '<span style="color:#dc2626;">High — investigate blockers.</span>' : ctP90 > 10 ? '<span style="color:#eab308;">Moderate.</span>' : '<span style="color:#16a34a;">Healthy.</span>'}
      ${ctTrend.direction !== "flat" ? ` Median <strong style="color:${ctTrend.isGood ? "#16a34a" : "#dc2626"};">${ctTrend.direction === "up" ? "increasing" : "decreasing"}</strong> (${fmt(ctThisMedian)}d → ${fmt(ctPriorMedian)}d prior).` : ""}
    </p>` : '<p style="color:#94a3b8;font-size:11px;">No cycle time data.</p>'}
    ${cycleTime ? criticalItemsTable(cycleTime.rows, ["Key", "Summary", "Priority", "Assignee", "Resolved"]) : ""}

    ${insights(deliveryGood, deliveryImprove)}

    <!-- ═══ PILLAR II : QUALITY ═══ -->
    ${pillar("II", "Quality", "#e05252", "Defect rates, escapes, regressions, rework — lower is better.", qualityScore)}

    ${metric("Defect Count & Density", `${totalBugs} bugs — ${defectDensity}% of completed work.`, defectDensityGrade)}
    ${allBugs ? monthlyTrendChart(allBugs.rows, "Created", "#e05252") : ""}
    ${allBugs ? criticalItemsTable(allBugs.rows, ["Key", "Summary", "Priority", "Status", "Created"]) : ""}

    ${metric("Escape Rate", `${prodBugs?.issueCount || 0} high-severity bugs (${fmt(escapeRate)}%). Critical/Highest priority bugs ÷ completed.`, escapeRateGrade)}
    ${
      prodBugs && prodBugs.issueCount > 0
        ? criticalItemsTable(prodBugs.rows, ["Key", "Summary", "Priority", "Created"])
        : '<p style="color:#16a34a;font-size:11px;">No high-severity bugs found.</p>'
    }

    ${metric("Regressions", `${regressions?.issueCount || 0} features broke after changes (${fmt(regressionRate)}%). Bugs with "regression" in summary or label.`, regressionGrade)}
    ${regressions ? criticalItemsTable(regressions.rows, ["Key", "Summary", "Priority", "Created"]) : ""}

    ${metric("Rework", `${rework?.issueCount || 0} reopened after Done (${fmt(reworkRate)}%). Items whose status reverted from Done.`, reworkGrade)}
    ${rework && rework.issueCount > 0 ? (() => {
      const reworkByType = countBy(rework.rows, "Issue Type");
      return typeDistributionBar(reworkByType);
    })() : ""}

    ${insights(qualityGood, qualityImprove)}

    <!-- ═══ PILLAR III : FLOW ═══ -->
    ${pillar("III", "Flow Efficiency", "#f59e0b", "WIP, blockers, and unplanned interruptions.", flowScore)}

    ${metric("Work in Progress", `${wipCount} items active.`)}
    ${wip ? (() => {
      const byType = countBy(wip.rows, "Issue Type");
      return typeDistributionBar(byType);
    })() : ""}
    ${wip ? criticalItemsTable(wip.rows, ["Key", "Summary", "Priority", "Issue Type", "Assignee"]) : ""}

    ${metric("Planned vs Unplanned", `${unplannedRatio}% reactive (bugs/incidents).`)}
    ${stackedBar([
      { label: "Planned", pct: 100 - parseFloat(unplannedRatio || "0"), color: "#009add" },
      { label: "Unplanned", pct: parseFloat(unplannedRatio || "0"), color: "#f97316" },
    ])}

    ${metric("Dependencies", `${blocked?.issueCount || 0} items flagged as blocked (impediment flag).`)}
    ${blocked ? criticalItemsTable(blocked.rows, ["Key", "Summary", "Priority", "Assignee", "Updated"]) : ""}

    ${insights(flowGood, flowImprove)}

    <!-- ═══ PILLAR IV : BACKLOG HEALTH ═══ -->
    ${pillar("IV", "Backlog Health", "#009add", "Pipeline readiness, grooming, and stale items.", backlogScore)}

    ${metric("Development Pipeline", `${devStageTotal} items in active development stages.`)}
    ${renderStageGroup(devStageEntries)}

    ${metric("Planning Pipeline", `${planningStageTotal} items in planning and discovery stages.`)}
    ${renderStageGroup(planningStageEntries)}

    ${metric("Pipeline Velocity", `${monthlyAvgCompletion} items/month avg completion rate over ${nonZeroMonths.length} months.`)}
    ${monthlyAvgCompletion > 0 ? `<table style="border-collapse:separate;border-spacing:6px 0;width:100%;table-layout:fixed;margin:8px 0;">
      <tr>
        <td style="width:33.33%;text-align:center;padding:0;">
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 8px;">
            <div style="font-size:22px;font-weight:800;color:#009add;">${monthlyAvgCompletion}</div>
            <div style="font-size:9px;color:#94a3b8;margin-top:2px;">Items/Month</div>
          </div>
        </td>
        <td style="width:33.33%;text-align:center;padding:0;">
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 8px;">
            <div style="font-size:22px;font-weight:800;color:#009add;">${pipelineDepth}</div>
            <div style="font-size:9px;color:#94a3b8;margin-top:2px;">Pipeline Depth</div>
          </div>
        </td>
        <td style="width:33.33%;text-align:center;padding:0;">
          <div style="background:${weeksOfWork > 12 ? "#fef2f2" : weeksOfWork > 8 ? "#fffbeb" : "#fff"};border:1px solid ${weeksOfWork > 12 ? "#fecaca" : weeksOfWork > 8 ? "#fde68a" : "#e2e8f0"};border-radius:10px;padding:14px 8px;">
            <div style="font-size:22px;font-weight:800;color:${weeksOfWork > 12 ? "#dc2626" : weeksOfWork > 8 ? "#eab308" : "#16a34a"};">${weeksOfWork}</div>
            <div style="font-size:9px;color:#94a3b8;margin-top:2px;">Weeks of Work</div>
          </div>
        </td>
      </tr>
    </table>
    <p style="font-size:10px;color:#94a3b8;margin:4px 0 0;line-height:1.4;">
      <strong style="color:#64748b;">Runway:</strong> At current rate (~${weeklyAvgCompletion}/week), the pipeline has ~${weeksOfWork} weeks of work.
      ${weeksOfWork > 12 ? '<span style="color:#dc2626;">Large backlog — consider prioritization review.</span>' : weeksOfWork > 8 ? '<span style="color:#eab308;">Healthy buffer.</span>' : weeksOfWork > 3 ? '<span style="color:#16a34a;">Good — pipeline is well-sized.</span>' : '<span style="color:#f59e0b;">Shallow — may need backlog grooming soon.</span>'}
    </p>` : '<p style="color:#94a3b8;font-size:11px;">No throughput data to compute velocity.</p>'}

    ${metric("Backlog Readiness", `${readyCount} groomed items ready to pull.`)}
    ${backlog && backlog.issueCount > 0 ? (() => {
      const byType = countBy(backlog.rows, "Issue Type");
      return typeDistributionBar(byType);
    })() : '<p style="color:#94a3b8;font-size:11px;">No groomed items without a sprint assignment.</p>'}

    ${metric("Discovery & Investigation", `${discovery?.issueCount || 0} open research and idea items.`)}
    ${discovery && discovery.issueCount > 0 ? (() => {
      const byType = countBy(discovery.rows, "Issue Type");
      return typeDistributionBar(byType);
    })() : '<p style="color:#94a3b8;font-size:11px;">No open research or idea items found.</p>'}

    ${insights(backlogGood, backlogImprove)}

    <!-- Footer -->
    <div style="margin-top:24px;padding-top:14px;border-top:1px solid #cbd6e2;text-align:center;">
      <img src="https://welcome.saas.mrisoftware.com/Content/images/MRI_Logo_RGB_Small.png" alt="MRI Software" style="height:24px;display:inline-block;margin-bottom:4px;" />
      <div style="font-size:10px;color:#778692;margin-top:2px;">${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
    </div>
  </div>
</div>`;

  return html;
}
