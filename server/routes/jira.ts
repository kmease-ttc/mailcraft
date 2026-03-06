import { Router } from "express";
import type {
  JiraTestRequest,
  JiraQueryRequest,
  JiraQueryResponse,
  JiraQueryResult,
} from "../../shared/types.js";
import {
  testJiraConnection,
  runJqlQuery,
  flattenIssue,
} from "../services/jira.js";
import { REPORT_SECTIONS, CHANGELOG_QUERY_IDS, buildSectionsForTeam, buildSectionsForTeams } from "../../shared/reportManifest.js";
import { JIRA_COLUMNS } from "../../shared/jiraQueries.js";
import { db } from "../db/index.js";
import { fetchRuns } from "../db/schema.js";

export const jiraRouter = Router();

// Return env-configured defaults so the UI auto-fills
jiraRouter.get("/defaults", (_req, res) => {
  res.json({
    domain: process.env.JIRA_DOMAIN || "",
    email: process.env.JIRA_EMAIL || "",
    apiToken: process.env.JIRA_API_TOKEN || "",
  });
});

// Test JIRA credentials
jiraRouter.post("/test", async (req, res) => {
  const { credentials } = req.body as JiraTestRequest;
  if (!credentials?.domain || !credentials?.email || !credentials?.apiToken) {
    return res.status(400).json({ error: "Missing credentials" });
  }
  try {
    const result = await testJiraConnection(credentials);
    res.json(result);
  } catch (err: any) {
    res.json({ ok: false, error: err.message });
  }
});

// Run selected JQL queries
jiraRouter.post("/query", async (req, res) => {
  const { credentials, queryIds, teamId, teamIds } = req.body as JiraQueryRequest & { teamId?: string; teamIds?: string[] };
  if (!credentials?.domain || !queryIds?.length) {
    return res.status(400).json({ error: "Missing credentials or queries" });
  }

  // Resolve which team(s) to query — single-select preferred
  const effectiveTeams = teamIds?.length ? teamIds : teamId ? [teamId] : ["lcsi"];
  console.log("[jira/query] requested teamIds:", teamIds, "| effective:", effectiveTeams);
  const sections = buildSectionsForTeams(effectiveTeams);
  const selected = sections.filter((s) => queryIds.includes(s.id));
  console.log("[jira/query] JQL sample:", selected[0]?.query.jql);
  if (!selected.length) {
    return res.status(400).json({ error: "No valid query IDs" });
  }

  const results: JiraQueryResult[] = [];

  for (const section of selected) {
    try {
      const needsChangelog = CHANGELOG_QUERY_IDS.has(section.id);
      const issues = await runJqlQuery(credentials, section.query.jql, 1000, {
        expandChangelog: needsChangelog,
      });
      const rows = issues.map((issue) =>
        flattenIssue(issue, section.query.label)
      );
      results.push({
        queryId: section.id,
        label: section.query.label,
        metrics: section.query.metrics,
        issueCount: issues.length,
        rows,
      });
    } catch (err: any) {
      results.push({
        queryId: section.id,
        label: section.query.label,
        metrics: section.query.metrics,
        issueCount: 0,
        rows: [],
        error: err.message,
      });
    }
  }

  const allRows = results.flatMap((r) => r.rows);
  const errorCount = results.filter((r) => r.error).length;
  const status =
    errorCount === 0
      ? "success"
      : errorCount < results.length
        ? "partial"
        : "error";

  // Persist to fetch_runs table (include teamIds so reports know which project)
  const fetchRunResult = db
    .insert(fetchRuns)
    .values({
      status,
      queryIds: JSON.stringify(queryIds),
      teamIds: JSON.stringify(effectiveTeams),
      resultsJson: JSON.stringify(results),
      totalRows: allRows.length,
      errorCount,
      triggeredBy: "manual",
      scheduleId: null,
      createdAt: new Date().toISOString(),
    })
    .run();

  const response: JiraQueryResponse & { queriedTeams?: string[] } = {
    results,
    totalRows: allRows.length,
    columns: JIRA_COLUMNS,
    fetchRunId: Number(fetchRunResult.lastInsertRowid),
    queriedTeams: effectiveTeams,
  };

  console.log("[jira/query] response: teams=%s, totalRows=%d, errors=%d", effectiveTeams, allRows.length, errorCount);
  res.json(response);
});
