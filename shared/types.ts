export interface CsvRow {
  [key: string]: string;
}

export interface EmailTemplate {
  subject: string;
  bodyHtml: string;
}

export interface EmailRecipient {
  email: string;
  data: CsvRow;
}

export interface SendEmailRequest {
  recipients: EmailRecipient[];
  template: EmailTemplate;
  emailColumn: string;
}

export interface SendEmailResult {
  email: string;
  success: boolean;
  error?: string;
}

// JIRA types

export interface JiraCredentials {
  domain: string;
  email: string;
  apiToken: string;
}

export interface JiraQueryDef {
  id: string;
  sheet: string;
  label: string;
  metrics: string;
  jql: string;
}

export interface JiraTestRequest {
  credentials: JiraCredentials;
}

export interface JiraQueryRequest {
  credentials: JiraCredentials;
  queryIds: string[];
}

export interface JiraQueryResult {
  queryId: string;
  label: string;
  metrics: string;
  issueCount: number;
  rows: CsvRow[];
  error?: string;
}

export interface JiraQueryResponse {
  results: JiraQueryResult[];
  totalRows: number;
  columns: string[];
  fetchRunId?: number;
}

// ── Persistence types ───────────────────────────────────────

export interface FetchRunRecord {
  id: number;
  status: "success" | "partial" | "error";
  queryIds: string[];
  totalRows: number;
  errorCount: number;
  triggeredBy: "manual" | "schedule";
  scheduleId: number | null;
  createdAt: string;
}

export interface FetchRunDetail extends FetchRunRecord {
  results: JiraQueryResult[];
}

export interface ReportRecord {
  id: number;
  fetchRunId: number;
  subject: string;
  createdAt: string;
  reportMeta: {
    totalIssues: number;
    queryCount: number;
    errorCount: number;
  } | null;
}

export interface ReportDetail extends ReportRecord {
  bodyHtml: string;
}

export interface EmailLogRecord {
  id: number;
  reportId: number;
  recipient: string;
  status: "sent" | "failed";
  resendId: string | null;
  error: string | null;
  sentAt: string;
}

export interface ScheduleRecord {
  id: number;
  name: string;
  cronExpr: string;
  recipients: string;
  subject: string | null;
  queryIds: string[] | null;
  teamIds: string[] | null;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleRequest {
  name: string;
  cronExpr: string;
  recipients: string;
  subject?: string;
  queryIds?: string[];
  teamIds?: string[];
  enabled?: boolean;
}

export interface UpdateScheduleRequest
  extends Partial<CreateScheduleRequest> {}

export interface SaveReportRequest {
  fetchRunId: number;
  subject: string;
  bodyHtml: string;
  reportMeta?: {
    totalIssues: number;
    queryCount: number;
    errorCount: number;
  };
}
