import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/** Each row = one complete JIRA data fetch (all queries run together) */
export const fetchRuns = sqliteTable("fetch_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status").notNull().default("success"), // "success" | "partial" | "error"
  queryIds: text("query_ids").notNull(), // JSON array
  resultsJson: text("results_json").notNull(), // Full JiraQueryResult[] as JSON
  totalRows: integer("total_rows").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  triggeredBy: text("triggered_by").notNull().default("manual"), // "manual" | "schedule"
  scheduleId: integer("schedule_id"), // FK to schedules (nullable)
  createdAt: text("created_at").notNull(),
});

/** Each row = one generated HTML report */
export const reports = sqliteTable("reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fetchRunId: integer("fetch_run_id")
    .notNull()
    .references(() => fetchRuns.id),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  reportMeta: text("report_meta"), // JSON: { totalIssues, queryCount, errorCount }
  createdAt: text("created_at").notNull(),
});

/** One row per email send attempt */
export const emailLog = sqliteTable("email_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reportId: integer("report_id")
    .notNull()
    .references(() => reports.id),
  recipient: text("recipient").notNull(),
  status: text("status").notNull(), // "sent" | "failed"
  resendId: text("resend_id"),
  error: text("error"),
  sentAt: text("sent_at").notNull(),
});

/** Recurring report schedule config */
export const schedules = sqliteTable("schedules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  cronExpr: text("cron_expr").notNull(),
  recipients: text("recipients").notNull(), // comma-separated
  subject: text("subject"), // nullable override
  queryIds: text("query_ids"), // nullable JSON array (null = all 13)
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastRunAt: text("last_run_at"),
  lastRunStatus: text("last_run_status"),
  nextRunAt: text("next_run_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
