import { Router } from "express";
import type { SendEmailRequest, SendEmailResult } from "../../shared/types.js";
import { sendEmail } from "../services/resend.js";

export const emailRouter = Router();

emailRouter.post("/send", async (req, res) => {
  const { recipients, template, emailColumn } = req.body as SendEmailRequest;

  if (!recipients?.length || !template?.subject || !template?.bodyHtml) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const results: SendEmailResult[] = [];

  for (const recipient of recipients) {
    const personalizedSubject = interpolate(template.subject, recipient.data);
    const personalizedBody = interpolate(template.bodyHtml, recipient.data);

    const result = await sendEmail({
      to: recipient.email,
      subject: personalizedSubject,
      html: personalizedBody,
    });

    results.push({
      email: recipient.email,
      success: result.success,
      error: result.error,
    });
  }

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  res.json({ sent, failed, results });
});

/** Replace {{column_name}} placeholders with row data */
function interpolate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? "");
}
