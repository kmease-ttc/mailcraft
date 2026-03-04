import { Router } from "express";
import type { SendEmailRequest, SendEmailResult } from "../../shared/types.js";
import { sendEmail } from "../services/resend.js";
import { db } from "../db/index.js";
import { emailLog } from "../db/schema.js";

export const emailRouter = Router();

emailRouter.post("/send", async (req, res) => {
  const { recipients, template, emailColumn, reportId } = req.body as SendEmailRequest & {
    reportId?: number;
  };

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

    // Log to DB if reportId is provided
    if (reportId && typeof reportId === "number") {
      db.insert(emailLog)
        .values({
          reportId,
          recipient: recipient.email,
          status: result.success ? "sent" : "failed",
          resendId: result.id || null,
          error: result.error || null,
          sentAt: new Date().toISOString(),
        })
        .run();
    }
  }

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  res.json({ sent, failed, results });
});

/** Replace {{column_name}} placeholders with row data */
function interpolate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? "");
}
