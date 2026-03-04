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
import { JIRA_QUERIES, JIRA_COLUMNS } from "../../shared/jiraQueries.js";
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
  const { credentials, queryIds } = req.body as JiraQueryRequest;
  if (!credentials?.domain || !queryIds?.length) {
    return res.status(400).json({ error: "Missing credentials or queries" });
  }

  const selected = JIRA_QUERIES.filter((q) => queryIds.includes(q.id));
  if (!selected.length) {
    return res.status(400).json({ error: "No valid query IDs" });
  }

  const results: JiraQueryResult[] = [];

  // Queries that need changelog for cycle time calculation
  const CHANGELOG_QUERIES = new Set(["cycle_time"]);

  for (const queryDef of selected) {
    try {
      const needsChangelog = CHANGELOG_QUERIES.has(queryDef.id);
      const issues = await runJqlQuery(credentials, queryDef.jql, 1000, {
        expandChangelog: needsChangelog,
      });
      const rows = issues.map((issue) =>
        flattenIssue(issue, queryDef.label)
      );
      results.push({
        queryId: queryDef.id,
        label: queryDef.label,
        metrics: queryDef.metrics,
        issueCount: issues.length,
        rows,
      });
    } catch (err: any) {
      results.push({
        queryId: queryDef.id,
        label: queryDef.label,
        metrics: queryDef.metrics,
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

  // Persist to fetch_runs table
  const fetchRunResult = db
    .insert(fetchRuns)
    .values({
      status,
      queryIds: JSON.stringify(queryIds),
      resultsJson: JSON.stringify(results),
      totalRows: allRows.length,
      errorCount,
      triggeredBy: "manual",
      scheduleId: null,
      createdAt: new Date().toISOString(),
    })
    .run();

  const response: JiraQueryResponse = {
    results,
    totalRows: allRows.length,
    columns: JIRA_COLUMNS,
    fetchRunId: Number(fetchRunResult.lastInsertRowid),
  };

  res.json(response);
});
