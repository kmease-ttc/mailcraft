import type { CsvRow } from "@shared/types";
import type { JiraQueryResult } from "@shared/types";

interface MetricSummary {
  queryId: string;
  label: string;
  metrics: string;
  count: number;
  error?: string;
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

/** Build an HTML horizontal bar chart */
function barChart(
  data: Map<string, number>,
  color = "#4f46e5"
): string {
  const max = Math.max(...data.values(), 1);
  const rows = [...data.entries()]
    .map(
      ([label, count]) => `
      <tr>
        <td style="padding:4px 12px 4px 0;font-size:13px;white-space:nowrap;color:#374151;width:160px;">${label}</td>
        <td style="padding:4px 0;width:100%;">
          <div style="background:${color};height:22px;border-radius:4px;width:${Math.max((count / max) * 100, 2)}%;min-width:2px;"></div>
        </td>
        <td style="padding:4px 0 4px 8px;font-size:13px;font-weight:600;color:#1e293b;white-space:nowrap;">${count}</td>
      </tr>`
    )
    .join("");

  return `<table style="border-collapse:collapse;width:100%;margin:12px 0;">${rows}</table>`;
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
    // Format as "Oct 25" etc
    const d = new Date(month + "-01");
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    data.set(label, items.length);
  }

  return barChart(data, color);
}

/** Build a simple HTML data table */
function dataTable(
  rows: CsvRow[],
  columns: string[],
  maxRows = 20
): string {
  if (!rows.length)
    return '<p style="color:#94a3b8;font-style:italic;">No data found.</p>';

  const display = rows.slice(0, maxRows);
  const ths = columns
    .map(
      (c) =>
        `<th style="background:#1e293b;color:#fff;padding:8px 10px;text-align:left;font-size:12px;font-weight:600;">${c}</th>`
    )
    .join("");

  const trs = display
    .map(
      (row, i) =>
        `<tr>${columns
          .map(
            (c) =>
              `<td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;${i % 2 ? "background:#f8fafc;" : ""}">${row[c] || ""}</td>`
          )
          .join("")}</tr>`
    )
    .join("");

  let html = `<table style="border-collapse:collapse;width:100%;margin:12px 0;"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;

  if (rows.length > maxRows) {
    html += `<p style="color:#94a3b8;font-size:12px;">Showing ${maxRows} of ${rows.length} rows.</p>`;
  }
  return html;
}

/** Metric box */
function metricBox(value: string | number, label: string): string {
  return `<div style="display:inline-block;background:#f1f5f9;border-radius:8px;padding:12px 20px;margin:4px 8px 4px 0;text-align:center;">
    <div style="font-size:28px;font-weight:700;color:#4f46e5;">${value}</div>
    <div style="font-size:11px;color:#64748b;margin-top:2px;">${label}</div>
  </div>`;
}

/** Section header */
function section(
  num: number,
  title: string,
  subtitle: string
): string {
  return `
  <div style="margin-top:32px;padding-top:24px;border-top:2px solid #e2e8f0;">
    <div style="display:flex;align-items:baseline;gap:8px;">
      <span style="background:#4f46e5;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;">${num}</span>
      <h3 style="margin:0;font-size:18px;color:#1e293b;">${title}</h3>
    </div>
    <p style="margin:4px 0 12px;font-size:13px;color:#64748b;">${subtitle}</p>
  </div>`;
}

/** Build the full SDLC metrics report HTML */
export function buildFullReport(
  results: JiraQueryResult[]
): string {
  const find = (id: string) =>
    results.find((r) => r.queryId === id);

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

  // Summary row data
  const summaries: MetricSummary[] = results.map((r) => ({
    queryId: r.queryId,
    label: r.label,
    metrics: r.metrics,
    count: r.issueCount,
    error: r.error,
  }));

  // Compute derived metrics
  const totalCompleted = throughput?.issueCount || 0;
  const totalBugs = allBugs?.issueCount || 0;
  const defectDensity =
    totalCompleted > 0
      ? ((totalBugs / totalCompleted) * 100).toFixed(1)
      : "N/A";
  const unplannedCount = unplanned?.issueCount || 0;
  const unplannedRatio =
    totalCompleted > 0
      ? ((unplannedCount / totalCompleted) * 100).toFixed(1)
      : "N/A";

  // Work type distribution
  const typeBreakdown = throughput
    ? countBy(throughput.rows, "Issue Type")
    : new Map();

  let html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;line-height:1.6;max-width:800px;margin:0 auto;">

  <div style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);color:#fff;padding:32px;border-radius:12px 12px 0 0;">
    <h1 style="margin:0;font-size:24px;font-weight:700;">SDLC Performance Metrics Report</h1>
    <p style="margin:6px 0 0;opacity:0.8;font-size:14px;">LSCI & LVAIRD — Last 26 Weeks — Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
  </div>

  <div style="background:#fff;padding:24px 32px;border:1px solid #e2e8f0;border-top:none;">

    <!-- Executive Summary -->
    <h2 style="margin:0 0 16px;font-size:20px;">Executive Summary</h2>

    <div style="margin-bottom:20px;">
      ${metricBox(totalCompleted, "Issues Completed")}
      ${metricBox(wip?.issueCount || 0, "In Progress")}
      ${metricBox(totalBugs, "Bugs Filed")}
      ${metricBox(defectDensity + "%", "Defect Density")}
      ${metricBox(unplannedRatio + "%", "Unplanned Work")}
      ${metricBox(aging?.issueCount || 0, "Aging Backlog")}
    </div>

    <!-- Summary Table -->
    <table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:13px;">
      <thead>
        <tr>
          <th style="background:#1e293b;color:#fff;padding:8px 10px;text-align:left;font-weight:600;">#</th>
          <th style="background:#1e293b;color:#fff;padding:8px 10px;text-align:left;font-weight:600;">Metric</th>
          <th style="background:#1e293b;color:#fff;padding:8px 10px;text-align:right;font-weight:600;">Count</th>
          <th style="background:#1e293b;color:#fff;padding:8px 10px;text-align:left;font-weight:600;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${summaries
          .map(
            (s, i) => `
          <tr>
            <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;${i % 2 ? "background:#f8fafc;" : ""}">${i + 1}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;${i % 2 ? "background:#f8fafc;" : ""}">${s.metrics}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;${i % 2 ? "background:#f8fafc;" : ""}">${s.error ? "—" : s.count}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;${i % 2 ? "background:#f8fafc;" : ""}">
              ${s.error ? `<span style="color:#ef4444;font-size:12px;">${s.error.slice(0, 60)}</span>` : `<span style="color:#22c55e;">✓</span>`}
            </td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>

    <!-- 1. Throughput & Work Type -->
    ${section(1, "Throughput & Work Type Distribution", `${totalCompleted} issues completed in the last 26 weeks`)}

    <h4 style="margin:12px 0 4px;font-size:14px;color:#374151;">By Issue Type</h4>
    ${barChart(typeBreakdown, "#4f46e5")}

    <h4 style="margin:16px 0 4px;font-size:14px;color:#374151;">Monthly Throughput</h4>
    ${throughput ? monthlyTrendChart(throughput.rows, "Resolved", "#6366f1") : ""}

    <!-- 2. Velocity -->
    ${section(2, "Velocity", `${velocity?.issueCount || 0} stories with story point estimates`)}
    ${
      velocity && velocity.rows.length
        ? (() => {
            const totalPts = velocity.rows.reduce(
              (s, r) => s + (parseFloat(r["Story Points"]) || 0),
              0
            );
            return `<div style="margin-bottom:12px;">${metricBox(totalPts, "Total Story Points")}</div>`;
          })()
        : ""
    }
    ${velocity ? monthlyTrendChart(velocity.rows, "Resolved", "#8b5cf6") : ""}

    <!-- 3. Cycle Time -->
    ${section(3, "Cycle Time", `${cycleTime?.issueCount || 0} issues measured`)}
    ${
      cycleTime
        ? dataTable(
            cycleTime.rows,
            ["Key", "Summary", "Assignee", "Created", "Resolved"],
            10
          )
        : ""
    }

    <!-- 4. Work in Progress -->
    ${section(4, "Work in Progress", `${wip?.issueCount || 0} items currently in progress`)}
    ${wip ? (() => {
      const byType = countBy(wip.rows, "Issue Type");
      return barChart(byType, "#f59e0b");
    })() : ""}
    ${
      wip
        ? dataTable(
            wip.rows,
            ["Key", "Summary", "Issue Type", "Priority", "Assignee"],
            15
          )
        : ""
    }

    <!-- 5. Backlog Readiness -->
    ${section(5, "Backlog Readiness", `${backlog?.issueCount || 0} refined items ready to pull`)}
    ${backlog ? (() => {
      const byType = countBy(backlog.rows, "Issue Type");
      return barChart(byType, "#06b6d4");
    })() : ""}

    <!-- 6. Defect Count & Density -->
    ${section(6, "Defect Count & Density", `${totalBugs} bugs filed — ${defectDensity}% defect density`)}
    <h4 style="margin:12px 0 4px;font-size:14px;color:#374151;">Bugs by Month</h4>
    ${allBugs ? monthlyTrendChart(allBugs.rows, "Created", "#ef4444") : ""}
    <h4 style="margin:12px 0 4px;font-size:14px;color:#374151;">Bug Status Breakdown</h4>
    ${allBugs ? barChart(countBy(allBugs.rows, "Status"), "#ef4444") : ""}

    <!-- 7. Defect Escape Rate -->
    ${section(7, "Defect Escape Rate", `${prodBugs?.issueCount || 0} production bugs (labeled prod-bug)`)}
    ${
      prodBugs && prodBugs.issueCount > 0
        ? dataTable(prodBugs.rows, ["Key", "Summary", "Priority", "Created"], 10)
        : '<p style="color:#22c55e;font-size:13px;">No production bugs found — escape rate: 0%</p>'
    }

    <!-- 8. Regression Rate -->
    ${section(8, "Regression Rate", `${regressions?.issueCount || 0} regression bugs`)}
    ${
      regressions && regressions.issueCount > 0
        ? dataTable(regressions.rows, ["Key", "Summary", "Priority", "Created"], 10)
        : '<p style="color:#22c55e;font-size:13px;">No regressions found.</p>'
    }

    <!-- 9. Rework Rate -->
    ${section(9, "Rework Rate", `${rework?.issueCount || 0} issues reopened after being marked Done`)}
    ${rework && rework.issueCount > 0 ? (() => {
      const byType = countBy(rework.rows, "Issue Type");
      return barChart(byType, "#f97316");
    })() : ""}

    <!-- 10. Planned vs Unplanned -->
    ${section(10, "Planned vs Unplanned Work", `${unplannedCount} unplanned items (${unplannedRatio}% of total)`)}
    <div style="margin:12px 0;">
      <div style="display:flex;height:28px;border-radius:6px;overflow:hidden;">
        <div style="background:#4f46e5;width:${100 - parseFloat(unplannedRatio || "0")}%;display:flex;align-items:center;padding:0 8px;">
          <span style="color:#fff;font-size:11px;font-weight:600;">Planned ${(100 - parseFloat(unplannedRatio || "0")).toFixed(0)}%</span>
        </div>
        <div style="background:#f97316;width:${parseFloat(unplannedRatio || "0")}%;display:flex;align-items:center;padding:0 8px;">
          <span style="color:#fff;font-size:11px;font-weight:600;">${unplannedRatio}%</span>
        </div>
      </div>
    </div>

    <!-- 11. Discovery -->
    ${section(11, "Discovery & Investigation", `${discovery?.issueCount || 0} spike/research items completed`)}
    ${
      discovery && discovery.issueCount > 0
        ? dataTable(discovery.rows, ["Key", "Summary", "Labels", "Resolved"], 10)
        : '<p style="color:#94a3b8;font-size:13px;">No items labeled spike/research/investigation found as Done.</p>'
    }

    <!-- 12. Dependencies / Blocked -->
    ${section(12, "Cross-Team Dependencies", `${blocked?.issueCount || 0} issues that were blocked`)}
    ${
      blocked && blocked.issueCount > 0
        ? dataTable(blocked.rows, ["Key", "Summary", "Priority", "Assignee", "Updated"], 10)
        : '<p style="color:#94a3b8;font-size:13px;">No blocked issues found.</p>'
    }

    <!-- 13. Aging Backlog -->
    ${section(13, "Aging Backlog", `${aging?.issueCount || 0} items with no update in 30+ days`)}
    ${aging && aging.issueCount > 0 ? (() => {
      const byType = countBy(aging.rows, "Issue Type");
      return barChart(byType, "#94a3b8");
    })() : ""}
    ${
      aging
        ? dataTable(
            aging.rows,
            ["Key", "Summary", "Issue Type", "Priority", "Updated"],
            15
          )
        : ""
    }

    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;">
      Generated by Mailcraft &middot; ${new Date().toLocaleDateString()}
    </div>
  </div>
</div>`;

  return html;
}
