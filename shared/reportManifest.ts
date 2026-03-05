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

/* ── Team Configurations ──────────────────────────────────────── */

export interface TeamConfig {
  id: string;
  label: string;
  projects: string[];  // Jira project keys
}

export const TEAM_CONFIGS: TeamConfig[] = [
  { id: "lsci", label: "LSCI", projects: ["LSCI"] },
  { id: "lvaird", label: "LVAIRD", projects: ["LVAIRD"] },
  { id: "rpmt", label: "RPMT", projects: ["RPMT"] },
  { id: "pxss", label: "PXSS", projects: ["PXSS"] },
  { id: "checkid", label: "CHECKID", projects: ["CHECKID"] },
  { id: "ctmpro", label: "CTMPRO", projects: ["CTMPRO"] },
];

export const DEFAULT_TEAM_ID = "lsci";

/** Build JQL project clause from project keys */
function projectClause(projects: string[]): string {
  if (projects.length === 1) return `project = ${projects[0]}`;
  return `project IN (${projects.join(", ")})`;
}

/** Generate report sections for a given team */
export function buildSectionsForTeam(teamId: string): ReportSection[] {
  const team = TEAM_CONFIGS.find((t) => t.id === teamId);
  // Use the team's configured projects, or fall back to teamId uppercased as a project key
  const projects = team ? team.projects : [teamId.toUpperCase()];
  const pc = projectClause(projects);
  return BASE_SECTIONS.map((s) => ({
    ...s,
    query: {
      ...s.query,
      jql: s.query.jql.replace(/PROJECT_CLAUSE/g, pc),
    },
  }));
}

/** Generate report sections for multiple teams (combines their project keys) */
export function buildSectionsForTeams(teamIds: string[]): ReportSection[] {
  if (teamIds.length === 0) return buildSectionsForTeam(DEFAULT_TEAM_ID);
  if (teamIds.length === 1) return buildSectionsForTeam(teamIds[0]);
  const allProjects = teamIds.flatMap((id) => {
    const t = TEAM_CONFIGS.find((c) => c.id === id);
    return t ? t.projects : [id.toUpperCase()];
  });
  const pc = projectClause(allProjects);
  return BASE_SECTIONS.map((s) => ({
    ...s,
    query: {
      ...s.query,
      jql: s.query.jql.replace(/PROJECT_CLAUSE/g, pc),
    },
  }));
}

/** Build a display label for multiple teams */
export function teamLabel(teamIds: string[]): string {
  return teamIds
    .map((id) => TEAM_CONFIGS.find((t) => t.id === id)?.label || id)
    .join(" + ");
}

/** Base sections with PROJECT_CLAUSE placeholder */
const BASE_SECTIONS: ReportSection[] = [
  // ═══ PILLAR I: DELIVERY PERFORMANCE ═══
  {
    id: "throughput",
    query: {
      sheet: "1_Throughput_WorkType",
      label: "Throughput + Work Type Distribution + Planned vs Unplanned",
      metrics: "Throughput, Work Type Distribution, Planned vs. Unplanned",
      jql: "PROJECT_CLAUSE AND status = Done AND resolved >= -26w ORDER BY resolved DESC",
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
      jql: 'PROJECT_CLAUSE AND status = Done AND resolved >= -26w AND ("Actual Story Points" > 0 OR "Estimated Story Points" > 0) ORDER BY resolved DESC',
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
      jql: 'PROJECT_CLAUSE AND status = Done AND resolved >= -26w AND (status WAS "In Development" OR status WAS "In Progress") ORDER BY resolved DESC',
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
      jql: "PROJECT_CLAUSE AND issuetype = Bug AND created >= -26w ORDER BY created DESC",
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
      jql: 'PROJECT_CLAUSE AND issuetype = Bug AND created >= -26w AND priority IN (P0, P1) ORDER BY created DESC',
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
      jql: 'PROJECT_CLAUSE AND issuetype = Bug AND created >= -26w AND (summary ~ "regression" OR summary ~ "regress" OR labels = "regression") ORDER BY created DESC',
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
      jql: "PROJECT_CLAUSE AND status WAS Done AND status != Done AND updated >= -26w ORDER BY updated DESC",
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
      jql: 'PROJECT_CLAUSE AND status IN ("In Progress", "In Development", "Under Review", "Ready for Testing", "Approval", "Ready for Development", "Planning") ORDER BY priority DESC',
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
      jql: "PROJECT_CLAUSE AND issuetype IN (Bug, Incident) AND status = Done AND resolved >= -26w ORDER BY resolved DESC",
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
      jql: 'PROJECT_CLAUSE AND flagged = impediment ORDER BY updated DESC',
    },
    template: {
      pillar: "flow",
      title: "Cross-Team Dependencies",
      description: "Issues flagged as blocked — impediments and external dependencies.",
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
      jql: 'PROJECT_CLAUSE AND status = "Open" AND sprint is EMPTY AND issuetype IN (Story, Bug, Task, Research) ORDER BY priority DESC',
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
      metrics: "Discovery & Investigation",
      jql: 'PROJECT_CLAUSE AND issuetype IN (Research, Idea) AND status NOT IN (Done, Cancel) ORDER BY updated DESC',
    },
    template: {
      pillar: "backlog_health",
      title: "Discovery & Investigation",
      description: "Open research and idea items — discovery work reducing uncertainty.",
      trendDateColumn: "Updated",
      upIsGood: true,
    },
  },
  {
    id: "stage_distribution",
    query: {
      sheet: "14_StageDistribution",
      label: "All Open Items by Stage",
      metrics: "Stage Distribution",
      jql: "PROJECT_CLAUSE AND status NOT IN (Done, Cancel) ORDER BY status ASC",
    },
    template: {
      pillar: "backlog_health",
      title: "Stage Distribution",
      description: "All open items grouped by workflow stage — shows backlog health at a glance.",
      trendDateColumn: "Updated",
      upIsGood: true,
    },
  },
];

/* ── Derived exports ────────────────────────────────────────── */

/** Default sections (LSCI/LVAIRD) for backward compatibility */
export const REPORT_SECTIONS: ReportSection[] = buildSectionsForTeam(DEFAULT_TEAM_ID);

/** All query IDs required by the current report template */
export const REPORT_QUERY_IDS: string[] = REPORT_SECTIONS.map((s) => s.id);

/** Query IDs that need changelog expansion */
export const CHANGELOG_QUERY_IDS: Set<string> = new Set(
  BASE_SECTIONS.filter((s) => s.needsChangelog).map((s) => s.id)
);

/** Convert to existing JiraQueryDef shape for backward compatibility */
export function toJiraQueryDefs(teamId?: string): JiraQueryDef[] {
  const sections = teamId ? buildSectionsForTeam(teamId) : REPORT_SECTIONS;
  return sections.map((s) => ({
    id: s.id,
    sheet: s.query.sheet,
    label: s.query.label,
    metrics: s.query.metrics,
    jql: s.query.jql,
  }));
}
