export interface EmailDef {
  id: string;
  queryId: string;
  subject: string;
  recipients: string;
  bodyHtml: string;
  tableColumns: string[];
}

const STYLE = `
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; line-height: 1.6; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 13px; }
  th { background: #475569; color: #fff; padding: 10px 12px; text-align: left; font-weight: 600; }
  td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  .metric-box { display: inline-block; background: #f1f5f9; border-radius: 8px; padding: 12px 20px; margin: 4px 8px 4px 0; text-align: center; }
  .metric-box .value { font-size: 28px; font-weight: 700; color: #4f46e5; }
  .metric-box .label { font-size: 12px; color: #64748b; }
  h2 { color: #1e293b; margin-bottom: 4px; }
  .subtitle { color: #64748b; font-size: 14px; margin-bottom: 20px; }
</style>`;

export const EMAIL_TEMPLATES: EmailDef[] = [
  {
    id: "throughput",
    queryId: "throughput",
    subject: "SDLC Metrics: Throughput & Work Type Distribution",
    recipients: "",
    bodyHtml: `${STYLE}
<h2>Throughput & Work Type Distribution</h2>
<p class="subtitle">Last 26 weeks — LSCI & LVAIRD</p>

<div>
  <div class="metric-box"><div class="value">{{issueCount}}</div><div class="label">Issues Completed</div></div>
</div>

<p>Below is the full breakdown of completed work:</p>

{{DATA_TABLE}}

<p>This data covers throughput, work type distribution, and planned vs. unplanned ratios.</p>
<p>Best,<br>Kevin</p>`,
    tableColumns: ["Key", "Summary", "Issue Type", "Status", "Sprint", "Resolved"],
  },
  {
    id: "velocity",
    queryId: "velocity",
    subject: "SDLC Metrics: Velocity & Stability",
    recipients: "",
    bodyHtml: `${STYLE}
<h2>Velocity & Velocity Stability</h2>
<p class="subtitle">Last 26 weeks — LSCI & LVAIRD</p>

<div>
  <div class="metric-box"><div class="value">{{issueCount}}</div><div class="label">Stories with Points</div></div>
</div>

<p>Completed stories with story point estimates:</p>

{{DATA_TABLE}}

<p>Use this to calculate velocity per sprint and stability (coefficient of variation).</p>
<p>Best,<br>Kevin</p>`,
    tableColumns: ["Key", "Summary", "Story Points", "Sprint", "Assignee", "Resolved"],
  },
  {
    id: "cycle_time",
    queryId: "cycle_time",
    subject: "SDLC Metrics: Cycle Time",
    recipients: "",
    bodyHtml: `${STYLE}
<h2>Cycle Time</h2>
<p class="subtitle">Last 26 weeks — LSCI & LVAIRD</p>

<div>
  <div class="metric-box"><div class="value">{{issueCount}}</div><div class="label">Issues Measured</div></div>
</div>

<p>Issues that transitioned through "In Progress" to "Done":</p>

{{DATA_TABLE}}

<p>Cycle time = Resolved date minus In Progress date. Target: median under 5 days.</p>
<p>Best,<br>Kevin</p>`,
    tableColumns: ["Key", "Summary", "Issue Type", "Assignee", "Created", "Resolved"],
  },
  {
    id: "wip",
    queryId: "wip",
    subject: "SDLC Metrics: Work in Progress Snapshot",
    recipients: "",
    bodyHtml: `${STYLE}
<h2>Work in Progress</h2>
<p class="subtitle">Current snapshot — LSCI & LVAIRD</p>

<div>
  <div class="metric-box"><div class="value">{{issueCount}}</div><div class="label">Items In Progress</div></div>
</div>

<p>All items currently in an "In Progress" state:</p>

{{DATA_TABLE}}

<p>High WIP is a leading indicator of cycle time problems. Target: limit WIP to team size.</p>
<p>Best,<br>Kevin</p>`,
    tableColumns: ["Key", "Summary", "Issue Type", "Priority", "Assignee", "Updated"],
  },
  {
    id: "backlog_readiness",
    queryId: "backlog_readiness",
    subject: "SDLC Metrics: Backlog Readiness",
    recipients: "",
    bodyHtml: `${STYLE}
<h2>Backlog Readiness</h2>
<p class="subtitle">Refined items not yet in a sprint — LSCI & LVAIRD</p>

<div>
  <div class="metric-box"><div class="value">{{issueCount}}</div><div class="label">Ready Items</div></div>
</div>

<p>Items marked "Ready for Development" but not assigned to a sprint:</p>

{{DATA_TABLE}}

<p>Target: at least 2 sprints worth of refined work ready to pull.</p>
<p>Best,<br>Kevin</p>`,
    tableColumns: ["Key", "Summary", "Priority", "Story Points", "Assignee"],
  },
  {
    id: "all_bugs",
    queryId: "all_bugs",
    subject: "SDLC Metrics: Defect Count & Density",
    recipients: "",
    bodyHtml: `${STYLE}
<h2>Defect Count & Density</h2>
<p class="subtitle">Bugs created in last 26 weeks — LSCI & LVAIRD</p>

<div>
  <div class="metric-box"><div class="value">{{issueCount}}</div><div class="label">Total Bugs</div></div>
</div>

<p>All bugs filed in the reporting period:</p>

{{DATA_TABLE}}

<p>Defect density = bugs / total completed issues in the same period.</p>
<p>Best,<br>Kevin</p>`,
    tableColumns: ["Key", "Summary", "Priority", "Assignee", "Labels", "Created"],
  },
  {
    id: "prod_bugs",
    queryId: "prod_bugs",
    subject: "SDLC Metrics: Defect Escape Rate",
    recipients: "",
    bodyHtml: `${STYLE}
<h2>Production Bugs (Defect Escape Rate)</h2>
<p class="subtitle">Last 26 weeks — LSCI & LVAIRD</p>

<div>
  <div class="metric-box"><div class="value">{{issueCount}}</div><div class="label">Prod Bugs</div></div>
</div>

<p>Bugs labeled "prod-bug" that escaped to production:</p>

{{DATA_TABLE}}

<p>Escape rate = prod bugs / total bugs. Target: under 15%.</p>
<p>Best,<br>Kevin</p>`,
    tableColumns: ["Key", "Summary", "Priority", "Assignee", "Created", "Status"],
  },
  {
    id: "regressions",
    queryId: "regressions",
    subject: "SDLC Metrics: Regression Rate",
    recipients: "",
    bodyHtml: `${STYLE}
<h2>Regression Bugs</h2>
<p class="subtitle">Last 26 weeks — LSCI & LVAIRD</p>

<div>
  <div class="metric-box"><div class="value">{{issueCount}}</div><div class="label">Regressions</div></div>
</div>

<p>Bugs labeled "regression" — changes that broke existing functionality:</p>

{{DATA_TABLE}}

<p>Regression rate = regression bugs / total bugs per sprint.</p>
<p>Best,<br>Kevin</p>`,
    tableColumns: ["Key", "Summary", "Priority", "Assignee", "Created"],
  },
  {
    id: "rework",
    queryId: "rework",
    subject: "SDLC Metrics: Rework Rate",
    recipients: "",
    bodyHtml: `${STYLE}
<h2>Rework (Reopened Issues)</h2>
<p class="subtitle">Last 26 weeks — LSCI & LVAIRD</p>

<div>
  <div class="metric-box"><div class="value">{{issueCount}}</div><div class="label">Reopened</div></div>
</div>

<p>Issues that were marked Done but later reopened:</p>

{{DATA_TABLE}}

<p>Rework rate = reopened / total completed. Target: under 10%.</p>
<p>Best,<br>Kevin</p>`,
    tableColumns: ["Key", "Summary", "Issue Type", "Assignee", "Status", "Updated"],
  },
  {
    id: "unplanned_work",
    queryId: "unplanned_work",
    subject: "SDLC Metrics: Planned vs Unplanned Work",
    recipients: "",
    bodyHtml: `${STYLE}
<h2>Unplanned Work</h2>
<p class="subtitle">Bugs + Incidents completed — last 26 weeks — LSCI & LVAIRD</p>

<div>
  <div class="metric-box"><div class="value">{{issueCount}}</div><div class="label">Unplanned Items</div></div>
</div>

<p>Reactive work (bugs and incidents) that was completed:</p>

{{DATA_TABLE}}

<p>Target: planned work should be 70%+ of total output.</p>
<p>Best,<br>Kevin</p>`,
    tableColumns: ["Key", "Summary", "Issue Type", "Priority", "Assignee", "Resolved"],
  },
  {
    id: "discovery",
    queryId: "discovery",
    subject: "SDLC Metrics: Discovery & Investigation",
    recipients: "",
    bodyHtml: `${STYLE}
<h2>Discovery & Investigation Work</h2>
<p class="subtitle">Spikes, research, investigations — last 26 weeks — LSCI & LVAIRD</p>

<div>
  <div class="metric-box"><div class="value">{{issueCount}}</div><div class="label">Discovery Items</div></div>
</div>

<p>Completed investigation and research work:</p>

{{DATA_TABLE}}

<p>Discovery ratio = discovery items / total completed.</p>
<p>Best,<br>Kevin</p>`,
    tableColumns: ["Key", "Summary", "Labels", "Assignee", "Resolved"],
  },
  {
    id: "blocked",
    queryId: "blocked",
    subject: "SDLC Metrics: Cross-Team Dependencies",
    recipients: "",
    bodyHtml: `${STYLE}
<h2>Blocked Issues (Dependencies)</h2>
<p class="subtitle">Last 6 months — LSCI & LVAIRD</p>

<div>
  <div class="metric-box"><div class="value">{{issueCount}}</div><div class="label">Blocked Issues</div></div>
</div>

<p>Issues that entered a "Blocked" state:</p>

{{DATA_TABLE}}

<p>Track average time blocked and which external teams are causing blocks.</p>
<p>Best,<br>Kevin</p>`,
    tableColumns: ["Key", "Summary", "Priority", "Assignee", "Status", "Updated"],
  },
];
