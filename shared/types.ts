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
}
