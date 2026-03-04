import type { JiraCredentials, CsvRow } from "../../shared/types.js";

const FIELDS = [
  "summary",
  "issuetype",
  "status",
  "priority",
  "assignee",
  "reporter",
  "created",
  "updated",
  "resolutiondate",
  "labels",
  "components",
  "fixVersions",
  "customfield_10016", // Story Points
  "customfield_10020", // Sprint
  "customfield_10014", // Epic Link
  "resolution",
  "timeoriginalestimate",
  "timespent",
];

function authHeader(creds: JiraCredentials): string {
  return (
    "Basic " +
    Buffer.from(`${creds.email}:${creds.apiToken}`).toString("base64")
  );
}

export async function testJiraConnection(
  creds: JiraCredentials
): Promise<{ ok: boolean; displayName?: string; error?: string }> {
  const url = `https://${creds.domain}/rest/api/3/myself`;
  const resp = await fetch(url, {
    headers: {
      Authorization: authHeader(creds),
      "Content-Type": "application/json",
    },
  });

  if (resp.ok) {
    const data = (await resp.json()) as { displayName?: string };
    return { ok: true, displayName: data.displayName };
  }
  return { ok: false, error: `${resp.status}: ${resp.statusText}` };
}

export async function runJqlQuery(
  creds: JiraCredentials,
  jql: string,
  maxResults = 1000
): Promise<any[]> {
  const auth = authHeader(creds);
  const allIssues: any[] = [];
  let nextPageToken: string | undefined;

  while (true) {
    const params = new URLSearchParams({
      jql,
      maxResults: String(Math.min(100, maxResults - allIssues.length)),
      fields: FIELDS.join(","),
    });
    if (nextPageToken) params.set("nextPageToken", nextPageToken);

    const url = `https://${creds.domain}/rest/api/3/search/jql?${params}`;
    const resp = await fetch(url, {
      headers: { Authorization: auth, Accept: "application/json" },
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`JIRA API ${resp.status}: ${text.slice(0, 300)}`);
    }

    const data = (await resp.json()) as {
      issues: any[];
      total: number;
      nextPageToken?: string;
    };
    const issues = data.issues || [];
    allIssues.push(...issues);

    if (!data.nextPageToken || allIssues.length >= maxResults) {
      break;
    }
    nextPageToken = data.nextPageToken;
  }

  return allIssues;
}

export function flattenIssue(issue: any, queryLabel: string): CsvRow {
  const f = issue.fields || {};

  const estimate = f.timeoriginalestimate;
  const spent = f.timespent;

  // Extract project key from issue key (e.g. "LSCI-123" → "LSCI")
  const key: string = issue.key || "";
  const project = key.split("-")[0] || "";

  return {
    Query: queryLabel,
    Project: project,
    Key: key,
    Summary: f.summary || "",
    "Issue Type": extractNested(f.issuetype),
    Status: extractNested(f.status),
    Priority: extractNested(f.priority),
    Assignee: extractNested(f.assignee, "displayName"),
    Reporter: extractNested(f.reporter, "displayName"),
    Sprint: extractSprintName(f.customfield_10020),
    "Story Points":
      f.customfield_10016 != null ? String(f.customfield_10016) : "",
    Labels: Array.isArray(f.labels) ? f.labels.join(", ") : "",
    Components: extractList(f.components),
    "Fix Versions": extractList(f.fixVersions),
    Created: formatDate(f.created),
    Updated: formatDate(f.updated),
    Resolved: formatDate(f.resolutiondate),
    Resolution: extractNested(f.resolution),
    "Time Estimate (hrs)": estimate
      ? String(Math.round((estimate / 3600) * 10) / 10)
      : "",
    "Time Spent (hrs)": spent
      ? String(Math.round((spent / 3600) * 10) / 10)
      : "",
    Epic: f.customfield_10014 || "",
  };
}

function extractNested(val: any, key = "name"): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  return val[key] || val.displayName || val.name || val.value || "";
}

function extractList(val: any): string {
  if (!Array.isArray(val)) return "";
  return val
    .map((item: any) =>
      typeof item === "string" ? item : item.name || item.value || String(item)
    )
    .join(", ");
}

function extractSprintName(sprintField: any): string {
  if (!sprintField) return "";
  if (Array.isArray(sprintField) && sprintField.length > 0) {
    const sprint = sprintField[sprintField.length - 1];
    if (typeof sprint === "object") return sprint.name || "";
    if (typeof sprint === "string" && sprint.includes("name=")) {
      return sprint.split("name=")[1]?.split(",")[0] || sprint;
    }
  }
  return String(sprintField);
}

function formatDate(dateStr: any): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toISOString().split("T")[0];
  } catch {
    return String(dateStr);
  }
}
