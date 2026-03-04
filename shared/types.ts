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
