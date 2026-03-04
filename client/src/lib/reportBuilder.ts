import type { CsvRow } from "@shared/types";
import type { JiraQueryResult } from "@shared/types";

/* ── helpers ─────────────────────────────────────────────────── */

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

/** Check if a priority value is P0/P1 (critical) */
const CRITICAL_PRIORITIES = new Set([
  "highest", "high", "blocker", "critical",
  "p0", "p1", "sev-0", "sev-1", "sub-0", "sub-1",
  "sub0", "sub1",
]);

function isCritical(row: CsvRow): boolean {
  const p = (row["Priority"] || "").toLowerCase().trim();
  return CRITICAL_PRIORITIES.has(p);
}

/** Build an HTML horizontal bar chart */
function barChart(
  data: Map<string, number>,
  color = "#4f46e5",
  suffix = ""
): string {
  const max = Math.max(...data.values(), 1);
  const rows = [...data.entries()]
    .map(
      ([label, count]) => `
      <tr>
        <td style="padding:3px 10px 3px 0;font-size:12px;white-space:nowrap;color:#374151;width:140px;">${label}</td>
        <td style="padding:3px 0;width:100%;">
          <div style="background:${color};height:20px;border-radius:3px;width:${Math.max((count / max) * 100, 2)}%;min-width:2px;"></div>
        </td>
        <td style="padding:3px 0 3px 8px;font-size:12px;font-weight:600;color:#1e293b;white-space:nowrap;">${count}${suffix}</td>
      </tr>`
    )
    .join("");

  return `<table style="border-collapse:collapse;width:100%;margin:8px 0;">${rows}</table>`;
}

/** Build a monthly trend bar chart */
function monthlyTrendChart(
  rows: CsvRow[],
  dateCol: string,
  color = "#4f46e5"
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

  return barChart(data, color);
}

/** Build a compact HTML data table (only used for critical items) */
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
        `<th style="background:#1e293b;color:#fff;padding:6px 8px;text-align:left;font-size:11px;font-weight:600;">${c}</th>`
    )
    .join("");

  const trs = display
    .map(
      (row, i) =>
        `<tr>${columns
          .map(
            (c) =>
              `<td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;${i % 2 ? "background:#f8fafc;" : ""}">${row[c] || ""}</td>`
          )
          .join("")}</tr>`
    )
    .join("");

  let html = `<table style="border-collapse:collapse;width:100%;margin:8px 0;"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;

  if (rows.length > maxRows) {
    html += `<p style="color:#94a3b8;font-size:11px;">Showing ${maxRows} of ${rows.length}.</p>`;
  }
  return html;
}

/**
 * Show a critical-items table ONLY if there are P0/P1 issues.
 * Returns empty string if no critical items exist.
 */
function criticalItemsTable(rows: CsvRow[], columns: string[]): string {
  const critical = rows.filter(isCritical);
  if (critical.length === 0) return "";

  return `
    <p style="margin:8px 0 4px;font-size:12px;font-weight:600;color:#dc2626;">&#9888; ${critical.length} critical-priority item${critical.length > 1 ? "s" : ""} (P0/P1):</p>
    ${dataTable(critical, columns, 10)}`;
}

/** Get YYYY-MM for current and prior month */
function getMonthKeys(): { current: string; prior: string } {
  const now = new Date();
  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const pri = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  return { current: cur, prior: pri };
}

/** Count rows matching a month in a given date column */
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

/**
 * Compute month-over-month trend.
 * @param upIsGood — true if increases are positive (e.g. throughput)
 */
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

/** Compute average age in days from a date column to today */
function avgAgeDays(rows: CsvRow[], dateCol: string): number {
  const now = Date.now();
  let total = 0;
  let count = 0;
  for (const row of rows) {
    const d = row[dateCol];
    if (!d) continue;
    const ms = now - new Date(d).getTime();
    if (ms > 0) {
      total += ms / (1000 * 60 * 60 * 24);
      count++;
    }
  }
  return count > 0 ? Math.round(total / count) : 0;
}

/* ── layout primitives ───────────────────────────────────────── */

/** Metric box (renders as a <td> for uniform sizing) */
function metricBox(
  value: string | number,
  label: string,
  trend?: TrendInfo
): string {
  const arrow =
    trend && trend.direction === "up"
      ? "&#9650;"
      : trend && trend.direction === "down"
        ? "&#9660;"
        : "";
  const trendColor =
    trend && trend.direction !== "flat"
      ? trend.isGood
        ? "#16a34a"
        : "#dc2626"
      : "#94a3b8";
  const trendText =
    trend && trend.direction !== "flat"
      ? `${arrow} ${Math.abs(trend.delta)} (${trend.pctChange})`
      : trend
        ? "— no change"
        : "";

  return `<td style="background:#f1f5f9;border-radius:8px;padding:14px 8px;text-align:center;width:16.66%;">
    <div style="font-size:28px;font-weight:700;color:#4f46e5;">${value}</div>
    <div style="font-size:11px;color:#64748b;margin-top:2px;">${label}</div>
    ${trendText ? `<div style="font-size:11px;font-weight:600;color:${trendColor};margin-top:4px;">${trendText}</div>` : ""}
  </td>`;
}

/** Pillar header */
function pillar(num: string, title: string, color: string, description: string): string {
  return `
  <div style="margin-top:36px;padding:16px 20px;background:linear-gradient(135deg,${color}10,${color}05);border-left:4px solid ${color};border-radius:0 8px 8px 0;">
    <h2 style="margin:0;font-size:17px;color:#1e293b;"><span style="color:${color};font-weight:800;">${num}</span> &nbsp;${title}</h2>
    <p style="margin:4px 0 0;font-size:12px;color:#64748b;">${description}</p>
  </div>`;
}

/** Metric sub-header within a pillar */
function metric(title: string, summary: string): string {
  return `
  <div style="margin-top:20px;">
    <h4 style="margin:0 0 2px;font-size:14px;color:#1e293b;">${title}</h4>
    <p style="margin:0 0 8px;font-size:12px;color:#64748b;">${summary}</p>
  </div>`;
}

/** Stacked percentage bar */
function stackedBar(segments: { label: string; pct: number; color: string }[]): string {
  const bars = segments
    .filter((s) => s.pct > 0)
    .map(
      (s) =>
        `<div style="background:${s.color};width:${s.pct}%;display:flex;align-items:center;justify-content:center;padding:0 6px;min-width:${s.pct > 5 ? 0 : 30}px;">
          <span style="color:#fff;font-size:10px;font-weight:600;white-space:nowrap;">${s.label} ${s.pct.toFixed(0)}%</span>
        </div>`
    )
    .join("");
  return `<div style="display:flex;height:26px;border-radius:5px;overflow:hidden;margin:8px 0;">${bars}</div>`;
}

/** Inline stat pair (two numbers side by side) */
function statPair(
  val1: string | number, label1: string,
  val2: string | number, label2: string,
  color = "#4f46e5"
): string {
  const box = (v: string | number, l: string) =>
    `<div style="display:inline-block;background:#f1f5f9;border-radius:8px;padding:12px 20px;text-align:center;min-width:100px;margin-right:8px;">
      <div style="font-size:24px;font-weight:700;color:${color};">${v}</div>
      <div style="font-size:11px;color:#64748b;margin-top:2px;">${l}</div>
    </div>`;
  return `<div style="margin:8px 0;">${box(val1, label1)}${box(val2, label2)}</div>`;
}

/* ── main report builder ─────────────────────────────────────── */

/** Build the full SDLC metrics report HTML */
export function buildFullReport(
  results: JiraQueryResult[]
): string {
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
  const aging = find("aging_backlog");

  // Derived metrics
  const totalCompleted = throughput?.issueCount || 0;
  const totalBugs = allBugs?.issueCount || 0;
  const defectDensity =
    totalCompleted > 0 ? ((totalBugs / totalCompleted) * 100).toFixed(1) : "N/A";
  const unplannedCount = unplanned?.issueCount || 0;
  const unplannedRatio =
    totalCompleted > 0 ? ((unplannedCount / totalCompleted) * 100).toFixed(1) : "N/A";

  // User story counts (filter by Issue Type = Story)
  const isStory = (r: CsvRow) => (r["Issue Type"] || "").toLowerCase() === "story";
  const storiesCompleted = throughput ? throughput.rows.filter(isStory).length : 0;
  const storiesInProgress = wip ? wip.rows.filter(isStory).length : 0;

  // Story points completed this month vs prior
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
    isGood: ptsDelta >= 0, // more points = good
  };

  // Stories completed this month vs prior (for trend)
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
    lastMonthCompleted > 0 ? ((lastMonthBugs / lastMonthCompleted) * 100).toFixed(1) : "N/A";
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
    pctChange: Math.abs(Math.round(densityDelta * 10) / 10) + "pp",
    direction: densityDelta > 0.5 ? "up" : densityDelta < -0.5 ? "down" : "flat",
    isGood: densityDelta <= 0,
  };

  // Velocity: story points per sprint
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
        return new Map(entries);
      })()
    : new Map<string, number>();
  const totalPts = velocity
    ? velocity.rows.reduce((s, r) => s + (parseFloat(r["Story Points"]) || 0), 0)
    : 0;
  const avgVelocity =
    sprintVelocity.size > 0 ? Math.round(totalPts / sprintVelocity.size) : 0;

  // Work type distribution (%)
  const typeBreakdown = throughput ? countBy(throughput.rows, "Issue Type") : new Map<string, number>();
  const typeTotal = [...typeBreakdown.values()].reduce((s, n) => s + n, 0) || 1;
  const typePct = new Map<string, number>();
  for (const [label, count] of typeBreakdown) {
    typePct.set(label, Math.round((count / typeTotal) * 100));
  }

  // Aging backlog stats
  const agingCount = aging?.issueCount || 0;
  const agingAvgDays = aging ? avgAgeDays(aging.rows, "Updated") : 0;
  const agingOver90 = aging
    ? aging.rows.filter((r) => {
        const d = r["Updated"];
        if (!d) return false;
        const days = (Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24);
        return days > 90;
      }).length
    : 0;

  /* ── HTML ───────────────────────────────────────────────────── */

  let html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;line-height:1.5;max-width:800px;margin:0 auto;">

  <div style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);color:#fff;padding:28px 32px;border-radius:12px 12px 0 0;">
    <h1 style="margin:0;font-size:22px;font-weight:700;">SDLC Performance Metrics Report</h1>
    <p style="margin:4px 0 0;opacity:0.8;font-size:13px;">LSCI &amp; LVAIRD — Last 26 Weeks — Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
  </div>

  <div style="background:#fff;padding:20px 28px;border:1px solid #e2e8f0;border-top:none;">

    <!-- ═══ EXECUTIVE SUMMARY ═══ -->
    <h2 style="margin:0 0 2px;font-size:18px;">Executive Summary</h2>
    <p style="margin:0 0 12px;font-size:12px;color:#64748b;">${curMonthLabel} vs prior month &middot; <span style="color:#16a34a;">&#9650; green = improving</span> &middot; <span style="color:#dc2626;">&#9650; red = needs attention</span></p>

    <table style="border-collapse:separate;border-spacing:6px 0;width:100%;table-layout:fixed;margin-bottom:16px;">
      <tr>
      ${metricBox(ptsThisMonth, "Story Pts", ptsTrend)}
      ${metricBox(storiesThisMonth, "Stories Done", storiesTrend)}
      ${metricBox(storiesInProgress, "Stories In Prog")}
      ${metricBox(bugsTrend?.currentVal ?? totalBugs, "Bugs Filed", bugsTrend)}
      ${metricBox(lastMonthDensity + "%", "Defect Density", densityTrend)}
      ${metricBox(unplannedTrend?.currentVal ?? unplannedCount, "Unplanned", unplannedTrend)}
      </tr>
    </table>

    <p style="font-size:11px;color:#94a3b8;margin:0 0 4px;">26-week totals: ${totalCompleted} items completed &middot; ${storiesCompleted} stories &middot; ${totalPts} story pts &middot; ${totalBugs} bugs &middot; ${agingCount} aging items</p>

    <!-- ═══ PILLAR I : DELIVERY ═══ -->
    ${pillar("I", "Delivery Performance", "#4f46e5", "How much work is getting done, how fast, and at what cadence.")}

    ${metric("Throughput", `${totalCompleted} items completed — distribution by issue type.`)}
    ${barChart(typePct, "#4f46e5", "%")}
    <h4 style="margin:12px 0 2px;font-size:13px;color:#374151;">Monthly Throughput</h4>
    ${throughput ? monthlyTrendChart(throughput.rows, "Resolved", "#6366f1") : ""}

    ${metric("Velocity", `${totalPts} story points across ${sprintVelocity.size} sprints — avg ${avgVelocity} pts/sprint.`)}
    ${sprintVelocity.size > 0 ? barChart(sprintVelocity, "#8b5cf6", " pts") : '<p style="color:#94a3b8;font-size:12px;">No sprint data available.</p>'}

    ${metric("Cycle Time", `${cycleTime?.issueCount || 0} items measured from "In Progress" to "Done."`)}
    ${cycleTime ? criticalItemsTable(cycleTime.rows, ["Key", "Summary", "Priority", "Assignee", "Resolved"]) : ""}

    <!-- ═══ PILLAR II : QUALITY ═══ -->
    ${pillar("II", "Quality", "#ef4444", "Defect rates, production escapes, regressions, and rework — lower is better.")}

    ${metric("Defect Count & Density", `${totalBugs} bugs filed — ${defectDensity}% of all completed work.`)}
    ${allBugs ? monthlyTrendChart(allBugs.rows, "Created", "#ef4444") : ""}
    ${allBugs ? criticalItemsTable(allBugs.rows, ["Key", "Summary", "Priority", "Status", "Created"]) : ""}

    ${metric("Defect Escape Rate", `${prodBugs?.issueCount || 0} bugs reached production.`)}
    ${
      prodBugs && prodBugs.issueCount > 0
        ? criticalItemsTable(prodBugs.rows, ["Key", "Summary", "Priority", "Created"])
        : '<p style="color:#16a34a;font-size:12px;">No production escapes found.</p>'
    }

    ${metric("Regression Rate", `${regressions?.issueCount || 0} previously working features broke after a change.`)}
    ${regressions ? criticalItemsTable(regressions.rows, ["Key", "Summary", "Priority", "Created"]) : ""}

    ${metric("Rework Rate", `${rework?.issueCount || 0} issues reopened after "Done" — signals missed requirements or premature closure.`)}
    ${rework && rework.issueCount > 0 ? barChart(countBy(rework.rows, "Issue Type"), "#f97316") : ""}

    <!-- ═══ PILLAR III : FLOW ═══ -->
    ${pillar("III", "Flow Efficiency", "#f59e0b", "Work-in-progress levels, blockers, and unplanned interruptions that affect throughput.")}

    ${metric("Work in Progress", `${wip?.issueCount || 0} items currently active — high WIP slows cycle time.`)}
    ${wip ? (() => {
      const byType = countBy(wip.rows, "Issue Type");
      return barChart(byType, "#f59e0b");
    })() : ""}
    ${wip ? criticalItemsTable(wip.rows, ["Key", "Summary", "Priority", "Issue Type", "Assignee"]) : ""}

    ${metric("Planned vs Unplanned", `${unplannedRatio}% of completed work was reactive (bugs/incidents).`)}
    ${stackedBar([
      { label: "Planned", pct: 100 - parseFloat(unplannedRatio || "0"), color: "#4f46e5" },
      { label: "Unplanned", pct: parseFloat(unplannedRatio || "0"), color: "#f97316" },
    ])}

    ${metric("Cross-Team Dependencies", `${blocked?.issueCount || 0} issues entered "Blocked" status due to external dependencies.`)}
    ${blocked ? criticalItemsTable(blocked.rows, ["Key", "Summary", "Priority", "Assignee", "Updated"]) : ""}

    <!-- ═══ PILLAR IV : BACKLOG HEALTH ═══ -->
    ${pillar("IV", "Backlog Health", "#06b6d4", "Pipeline readiness, research investment, and stale items that need attention.")}

    ${metric("Backlog Readiness", `${backlog?.issueCount || 0} groomed items ready to pull into a sprint.`)}
    ${backlog ? barChart(countBy(backlog.rows, "Issue Type"), "#06b6d4") : ""}

    ${metric("Discovery & Investigation", `${discovery?.issueCount || 0} spikes/research items completed — reducing future uncertainty.`)}

    ${metric("Aging Backlog", `${agingCount} items with no activity for 30+ days.`)}
    ${agingCount > 0
      ? statPair(
          agingAvgDays + "d", "Avg Age",
          agingOver90, "Over 90 Days",
          "#94a3b8"
        )
      : '<p style="color:#16a34a;font-size:12px;">No aging items.</p>'
    }

    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px;">
      Generated by Mailcraft &middot; ${new Date().toLocaleDateString()}
    </div>
  </div>
</div>`;

  return html;
}
