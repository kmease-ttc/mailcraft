import { toJiraQueryDefs } from "./reportManifest";

/** Derived from reportManifest.ts — the single source of truth */
export const JIRA_QUERIES = toJiraQueryDefs();

export const JIRA_COLUMNS = [
  "Query",
  "Project",
  "Key",
  "Summary",
  "Issue Type",
  "Status",
  "Priority",
  "Assignee",
  "Reporter",
  "Sprint",
  "Story Points",
  "Labels",
  "Components",
  "Fix Versions",
  "Created",
  "Updated",
  "Resolved",
  "Resolution",
  "Time Estimate (hrs)",
  "Time Spent (hrs)",
  "Epic",
];
