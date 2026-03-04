import type { JiraQueryDef } from "./types";

/** Which report pillar a section belongs to */
export type ReportPillar = "delivery" | "quality" | "flow" | "backlog_health";

/** A single section of the report, coupling query definition with template metadata */
export interface ReportSection {
  /** Unique ID — used to look up query results (e.g., "throughput") */
  id: string;
  /** JQL query definition */
  query: {
    sheet: string;
    label: string;
    metrics: string;
    jql: string;
  };
  /** Report template metadata */
  template: {
    pillar: ReportPillar;
    title: string;
    description: string;
    trendDateColumn: string;
    upIsGood: boolean;
  };
  /** Whether this query needs JIRA changelog expansion (e.g., cycle_time) */
  needsChangelog?: boolean;
}

export const REPORT_SECTIONS: ReportSection[] = [
  // ═══ PILLAR I: DELIVERY PERFORMANCE ═══
  {
    id: "throughput",
    query: {
      sheet: "1_Throughput_WorkType",
      label: "Throughput + Work Type Distribution + Planned vs Unplanned",
      metrics: "Throughput, Work Type Distribution, Planned vs. Unplanned",
      jql: "project IN (LSCI, LVAIRD) AND status = Done AND resolved >= -26w ORDER BY resolved DESC",
    },
    template: {
      pillar: "delivery",
      title: "Throughput",
      description: "Total items completed — distribution by issue type.",
      trendDateColumn: "Resolved",
      upIsGood: true,
    },
  },
  {
    id: "velocity",
    query: {
      sheet: "2_Velocity",
      label: "Velocity + Velocity Stability",
      metrics: "Velocity, Velocity Stability",
      jql: 'project IN (LSCI, LVAIRD) AND status = Done AND resolved >= -26w AND ("Actual Story Points" > 0 OR "Estimated Story Points" > 0) ORDER BY resolved DESC',
    },
    template: {
      pillar: "delivery",
      title: "Velocity",
      description: "Story points across sprints.",
      trendDateColumn: "Resolved",
      upIsGood: true,
    },
  },
  {
    id: "cycle_time",
    query: {
      sheet: "3_CycleTime",
      label: "Cycle Time",
      metrics: "Cycle Time",
      jql: 'project IN (LSCI, LVAIRD) AND status = Done AND resolved >= -26w AND status WAS "In Progress" ORDER BY resolved DESC',
    },
    template: {
      pillar: "delivery",
      title: "Cycle Time",
      description: "In Progress to Done duration.",
      trendDateColumn: "Resolved",
      upIsGood: false,
    },
    needsChangelog: true,
  },

  // ═══ PILLAR II: QUALITY ═══
  {
    id: "all_bugs",
    query: {
      sheet: "6_AllBugs",
      label: "All Bugs (Defect Count / Defect Density)",
      metrics: "Defect Count, Defect Density",
      jql: "project IN (LSCI, LVAIRD) AND issuetype = Bug AND created >= -26w ORDER BY created DESC",
    },
    template: {
      pillar: "quality",
      title: "Defect Count & Density",
      description: "Bug filings and defect density over 26 weeks.",
      trendDateColumn: "Created",
      upIsGood: false,
    },
  },
  {
    id: "prod_bugs",
    query: {
      sheet: "7_ProdBugs",
      label: "Production Bugs (Defect Escape Rate)",
      metrics: "Defect Escape Rate",
      jql: 'project IN (LSCI, LVAIRD) AND issuetype = Bug AND created >= -26w AND labels = "prod-bug" ORDER BY created DESC',
    },
    template: {
      pillar: "quality",
      title: "Defect Escape Rate",
      description: "Bugs that reached production.",
      trendDateColumn: "Created",
      upIsGood: false,
    },
  },
  {
    id: "regressions",
    query: {
      sheet: "8_Regressions",
      label: "Regression Bugs",
      metrics: "Regression Rate",
      jql: 'project IN (LSCI, LVAIRD) AND issuetype = Bug AND labels = "regression" AND created >= -26w ORDER BY created DESC',
    },
    template: {
      pillar: "quality",
      title: "Regression Rate",
      description: "Previously working features broken by a change.",
      trendDateColumn: "Created",
      upIsGood: false,
    },
  },
  {
    id: "rework",
    query: {
      sheet: "9_Rework",
      label: "Rework (reopened issues)",
      metrics: "Rework Rate",
      jql: "project IN (LSCI, LVAIRD) AND status WAS Done AND status != Done AND updated >= -26w ORDER BY updated DESC",
    },
    template: {
      pillar: "quality",
      title: "Rework Rate",
      description: "Issues reopened after Done — missed requirements or premature closure.",
      trendDateColumn: "Updated",
      upIsGood: false,
    },
  },

  // ═══ PILLAR III: FLOW EFFICIENCY ═══
  {
    id: "wip",
    query: {
      sheet: "4_WIP",
      label: "Work in Progress (current snapshot)",
      metrics: "Work in Progress",
      jql: 'project IN (LSCI, LVAIRD) AND status = "In Progress" ORDER BY priority DESC',
    },
    template: {
      pillar: "flow",
      title: "Work in Progress",
      description: "Current snapshot of active items.",
      trendDateColumn: "Updated",
      upIsGood: false,
    },
  },
  {
    id: "unplanned_work",
    query: {
      sheet: "10_UnplannedWork",
      label: "Unplanned Work (Bugs + Incidents completed)",
      metrics: "Planned vs. Unplanned (unplanned side)",
      jql: "project IN (LSCI, LVAIRD) AND issuetype IN (Bug, Incident) AND status = Done AND resolved >= -26w ORDER BY resolved DESC",
    },
    template: {
      pillar: "flow",
      title: "Planned vs Unplanned",
      description: "Reactive work (bugs/incidents) as a share of output.",
      trendDateColumn: "Resolved",
      upIsGood: false,
    },
  },
  {
    id: "blocked",
    query: {
      sheet: "12_Blocked",
      label: "Blocked Issues (Dependencies)",
      metrics: "Cross-Team Dependencies",
      jql: 'project IN (LSCI, LVAIRD) AND status WAS "Blocked" DURING (startOfMonth(-6), now()) ORDER BY updated DESC',
    },
    template: {
      pillar: "flow",
      title: "Cross-Team Dependencies",
      description: "Issues blocked by external dependencies.",
      trendDateColumn: "Updated",
      upIsGood: false,
    },
  },

  // ═══ PILLAR IV: BACKLOG HEALTH ═══
  {
    id: "backlog_readiness",
    query: {
      sheet: "5_BacklogReadiness",
      label: "Backlog Readiness",
      metrics: "Backlog Readiness",
      jql: 'project IN (LSCI, LVAIRD) AND status = "Ready for Development" AND sprint is EMPTY ORDER BY priority DESC',
    },
    template: {
      pillar: "backlog_health",
      title: "Backlog Readiness",
      description: "Groomed items ready to pull into a sprint.",
      trendDateColumn: "Updated",
      upIsGood: true,
    },
  },
  {
    id: "discovery",
    query: {
      sheet: "11_Discovery",
      label: "Discovery / Investigation Work",
      metrics: "Discovery & Investigation Ratio",
      jql: 'project IN (LSCI, LVAIRD) AND labels IN ("spike", "research", "investigation") AND status = Done AND resolved >= -26w ORDER BY resolved DESC',
    },
    template: {
      pillar: "backlog_health",
      title: "Discovery & Investigation",
      description: "Spikes and research items completed to reduce uncertainty.",
      trendDateColumn: "Resolved",
      upIsGood: true,
    },
  },
  {
    id: "aging_backlog",
    query: {
      sheet: "13_AgingBacklog",
      label: "Aging Backlog (no update in 30+ days)",
      metrics: "Aging Backlog",
      jql: "project IN (LSCI, LVAIRD) AND status NOT IN (Done, Closed, Cancelled) AND updated <= -30d ORDER BY updated ASC",
    },
    template: {
      pillar: "backlog_health",
      title: "Aging Backlog",
      description: "Items with no activity for 30+ days.",
      trendDateColumn: "Updated",
      upIsGood: false,
    },
  },
];

/* ── Derived exports ────────────────────────────────────────── */

/** All query IDs required by the current report template */
export const REPORT_QUERY_IDS: string[] = REPORT_SECTIONS.map((s) => s.id);

/** Query IDs that need changelog expansion */
export const CHANGELOG_QUERY_IDS: Set<string> = new Set(
  REPORT_SECTIONS.filter((s) => s.needsChangelog).map((s) => s.id)
);

/** Convert to existing JiraQueryDef shape for backward compatibility */
export function toJiraQueryDefs(): JiraQueryDef[] {
  return REPORT_SECTIONS.map((s) => ({
    id: s.id,
    sheet: s.query.sheet,
    label: s.query.label,
    metrics: s.query.metrics,
    jql: s.query.jql,
  }));
}
