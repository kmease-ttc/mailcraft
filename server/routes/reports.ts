import { Router } from "express";
import { db } from "../db/index.js";
import { fetchRuns, reports, emailLog } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import type { SaveReportRequest } from "../../shared/types.js";

export const reportsRouter = Router();

// GET / — list all saved reports (no bodyHtml)
reportsRouter.get("/", (_req, res) => {
  const rows = db
    .select({
      id: reports.id,
      fetchRunId: reports.fetchRunId,
      subject: reports.subject,
      reportMeta: reports.reportMeta,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .orderBy(desc(reports.createdAt))
    .all();

  res.json(
    rows.map((r) => ({
      ...r,
      reportMeta: r.reportMeta ? JSON.parse(r.reportMeta) : null,
    }))
  );
});

// GET /:id — get a specific report with full HTML
reportsRouter.get("/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const row = db.select().from(reports).where(eq(reports.id, id)).get();
  if (!row) return res.status(404).json({ error: "Report not found" });

  res.json({
    ...row,
    reportMeta: row.reportMeta ? JSON.parse(row.reportMeta) : null,
  });
});

// POST / — save a new report
reportsRouter.post("/", (req, res) => {
  const body = req.body as SaveReportRequest;
  if (!body.fetchRunId || !body.subject || !body.bodyHtml) {
    return res
      .status(400)
      .json({ error: "Missing required fields: fetchRunId, subject, bodyHtml" });
  }

  const run = db
    .select()
    .from(fetchRuns)
    .where(eq(fetchRuns.id, body.fetchRunId))
    .get();
  if (!run) return res.status(400).json({ error: "fetch_run not found" });

  const result = db
    .insert(reports)
    .values({
      fetchRunId: body.fetchRunId,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      reportMeta: body.reportMeta ? JSON.stringify(body.reportMeta) : null,
      createdAt: new Date().toISOString(),
    })
    .run();

  res.json({ id: Number(result.lastInsertRowid) });
});

// GET /:id/emails — email log for a specific report
reportsRouter.get("/:id/emails", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const rows = db
    .select()
    .from(emailLog)
    .where(eq(emailLog.reportId, id))
    .orderBy(desc(emailLog.sentAt))
    .all();

  res.json(rows);
});
