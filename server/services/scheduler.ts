import cron, { type ScheduledTask } from "node-cron";
import { db } from "../db/index.js";
import { fetchRuns, reports, emailLog, schedules } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { REPORT_SECTIONS, REPORT_QUERY_IDS, CHANGELOG_QUERY_IDS, buildSectionsForTeams, teamLabel } from "../../shared/reportManifest.js";
import { runJqlQuery, flattenIssue } from "./jira.js";
import { sendEmail } from "./sendgrid.js";
import type { JiraCredentials, JiraQueryResult } from "../../shared/types.js";
import { buildFullReport } from "../../client/src/lib/reportBuilder.js";

// In-memory registry of active cron tasks
const activeTasks = new Map<number, ScheduledTask>();

function getJiraCreds(): JiraCredentials {
  return {
    domain: process.env.JIRA_DOMAIN || "",
    email: process.env.JIRA_EMAIL || "",
    apiToken: process.env.JIRA_API_TOKEN || "",
  };
}

/**
 * Execute a full scheduled run: fetch JIRA -> build report -> save -> email -> log
 */
export async function executeScheduledRun(
  schedule: typeof schedules.$inferSelect
): Promise<{
  fetchRunId: number;
  reportId: number;
  emailsSent: number;
  emailsFailed: number;
}> {
  const creds = getJiraCreds();
  if (!creds.domain) throw new Error("JIRA credentials not configured in .env");

  const queryIds: string[] = schedule.queryIds
    ? JSON.parse(schedule.queryIds)
    : REPORT_QUERY_IDS;

  // Use team-specific sections so JQL targets the correct Jira project(s)
  const scheduleTeamIds: string[] = schedule.teamIds
    ? JSON.parse(schedule.teamIds)
    : [];
  const allSections = scheduleTeamIds.length > 0
    ? buildSectionsForTeams(scheduleTeamIds)
    : REPORT_SECTIONS;
  const selected = allSections.filter((s) => queryIds.includes(s.id));

  // 1. Fetch JIRA data
  const results: JiraQueryResult[] = [];
  for (const section of selected) {
    try {
      const needsChangelog = CHANGELOG_QUERY_IDS.has(section.id);
      const issues = await runJqlQuery(creds, section.query.jql, 1000, {
        expandChangelog: needsChangelog,
      });
      const rows = issues.map((issue) => flattenIssue(issue, section.query.label));
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

  const errorCount = results.filter((r) => r.error).length;
  const totalRows = results.reduce((s, r) => s + r.rows.length, 0);
  const status =
    errorCount === 0
      ? "success"
      : errorCount < results.length
        ? "partial"
        : "error";
  const now = new Date().toISOString();

  // 2. Save fetch_run
  const fetchRunResult = db
    .insert(fetchRuns)
    .values({
      status,
      queryIds: JSON.stringify(queryIds),
      teamIds: scheduleTeamIds.length > 0 ? JSON.stringify(scheduleTeamIds) : null,
      resultsJson: JSON.stringify(results),
      totalRows,
      errorCount,
      triggeredBy: "schedule",
      scheduleId: schedule.id,
      createdAt: now,
    })
    .run();
  const fetchRunId = Number(fetchRunResult.lastInsertRowid);

  // 3. Build report HTML
  const bodyHtml = buildFullReport(results);
  const teamName = scheduleTeamIds.length > 0 ? teamLabel(scheduleTeamIds) : "LCSI";
  const subject =
    schedule.subject ||
    `${teamName} — SDLC Performance Metrics — ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;

  // 4. Save report
  const totalIssues = results.reduce((s, r) => s + r.issueCount, 0);
  const reportResult = db
    .insert(reports)
    .values({
      fetchRunId,
      subject,
      bodyHtml,
      reportMeta: JSON.stringify({
        totalIssues,
        queryCount: results.length,
        errorCount,
      }),
      createdAt: now,
    })
    .run();
  const reportId = Number(reportResult.lastInsertRowid);

  // 5. Send emails
  const recipientList = schedule.recipients
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  let emailsSent = 0;
  let emailsFailed = 0;

  for (const recipient of recipientList) {
    const result = await sendEmail({
      to: recipient,
      subject,
      html: bodyHtml,
    });

    db.insert(emailLog)
      .values({
        reportId,
        recipient,
        status: result.success ? "sent" : "failed",
        resendId: result.id || null,
        error: result.error || null,
        sentAt: new Date().toISOString(),
      })
      .run();

    if (result.success) emailsSent++;
    else emailsFailed++;
  }

  // 6. Update schedule metadata
  db.update(schedules)
    .set({
      lastRunAt: now,
      lastRunStatus: status,
      updatedAt: now,
    })
    .where(eq(schedules.id, schedule.id))
    .run();

  console.log(
    `[Scheduler] Schedule "${schedule.name}" ran: ${totalIssues} issues, ` +
      `${emailsSent} emails sent, ${emailsFailed} failed`
  );

  return { fetchRunId, reportId, emailsSent, emailsFailed };
}

/** Register a schedule's cron task in-process */
export function registerSchedule(
  schedule: typeof schedules.$inferSelect
): void {
  unregisterSchedule(schedule.id);

  if (!cron.validate(schedule.cronExpr)) {
    console.warn(
      `[Scheduler] Invalid cron for schedule ${schedule.id}: ${schedule.cronExpr}`
    );
    return;
  }

  const task = cron.schedule(schedule.cronExpr, async () => {
    console.log(
      `[Scheduler] Firing schedule "${schedule.name}" (id=${schedule.id})`
    );
    try {
      const current = db
        .select()
        .from(schedules)
        .where(eq(schedules.id, schedule.id))
        .get();
      if (!current || !current.enabled) {
        console.log(
          `[Scheduler] Schedule ${schedule.id} is disabled or deleted, skipping.`
        );
        return;
      }
      await executeScheduledRun(current);
    } catch (err) {
      console.error(`[Scheduler] Error running schedule ${schedule.id}:`, err);
    }
  });

  activeTasks.set(schedule.id, task);
  console.log(
    `[Scheduler] Registered: "${schedule.name}" — ${schedule.cronExpr}`
  );
}

/** Unregister a cron task */
export function unregisterSchedule(id: number): void {
  const task = activeTasks.get(id);
  if (task) {
    task.stop();
    activeTasks.delete(id);
  }
}

/** Load all enabled schedules from DB and register them (called at startup) */
export function initializeScheduler(): void {
  const enabled = db
    .select()
    .from(schedules)
    .where(eq(schedules.enabled, true))
    .all();

  for (const schedule of enabled) {
    registerSchedule(schedule);
  }

  console.log(
    `[Scheduler] Initialized with ${enabled.length} active schedule(s)`
  );
}
