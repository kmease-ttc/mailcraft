import { Router } from "express";
import { db } from "../db/index.js";
import { schedules } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import {
  registerSchedule,
  unregisterSchedule,
  executeScheduledRun,
} from "../services/scheduler.js";
import type { CreateScheduleRequest, UpdateScheduleRequest } from "../../shared/types.js";
import cron from "node-cron";

export const schedulesRouter = Router();

function parseSchedule(row: typeof schedules.$inferSelect) {
  return {
    ...row,
    enabled: Boolean(row.enabled),
    queryIds: row.queryIds ? JSON.parse(row.queryIds) : null,
  };
}

// GET / — list all schedules
schedulesRouter.get("/", (_req, res) => {
  const rows = db
    .select()
    .from(schedules)
    .orderBy(desc(schedules.createdAt))
    .all();

  res.json(rows.map(parseSchedule));
});

// POST / — create a new schedule
schedulesRouter.post("/", (req, res) => {
  const body = req.body as CreateScheduleRequest;
  if (!body.name || !body.cronExpr || !body.recipients) {
    return res
      .status(400)
      .json({ error: "Missing required fields: name, cronExpr, recipients" });
  }

  if (!cron.validate(body.cronExpr)) {
    return res.status(400).json({ error: "Invalid cron expression" });
  }

  const now = new Date().toISOString();
  const result = db
    .insert(schedules)
    .values({
      name: body.name,
      cronExpr: body.cronExpr,
      recipients: body.recipients,
      subject: body.subject || null,
      queryIds: body.queryIds ? JSON.stringify(body.queryIds) : null,
      enabled: body.enabled !== false,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const id = Number(result.lastInsertRowid);
  const row = db.select().from(schedules).where(eq(schedules.id, id)).get()!;

  if (row.enabled) registerSchedule(row);

  res.json(parseSchedule(row));
});

// PATCH /:id — update a schedule
schedulesRouter.patch("/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const existing = db.select().from(schedules).where(eq(schedules.id, id)).get();
  if (!existing) return res.status(404).json({ error: "Schedule not found" });

  const body = req.body as UpdateScheduleRequest;

  if (body.cronExpr && !cron.validate(body.cronExpr)) {
    return res.status(400).json({ error: "Invalid cron expression" });
  }

  const updates: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  };
  if (body.name !== undefined) updates.name = body.name;
  if (body.cronExpr !== undefined) updates.cronExpr = body.cronExpr;
  if (body.recipients !== undefined) updates.recipients = body.recipients;
  if (body.subject !== undefined) updates.subject = body.subject || null;
  if (body.queryIds !== undefined)
    updates.queryIds = body.queryIds ? JSON.stringify(body.queryIds) : null;
  if (body.enabled !== undefined) updates.enabled = body.enabled;

  db.update(schedules).set(updates).where(eq(schedules.id, id)).run();

  // Re-register with cron
  unregisterSchedule(id);
  const updated = db.select().from(schedules).where(eq(schedules.id, id)).get()!;
  if (updated.enabled) registerSchedule(updated);

  res.json(parseSchedule(updated));
});

// DELETE /:id — delete a schedule
schedulesRouter.delete("/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  unregisterSchedule(id);
  const result = db.delete(schedules).where(eq(schedules.id, id)).run();

  if (result.changes === 0) {
    return res.status(404).json({ error: "Schedule not found" });
  }

  res.json({ ok: true });
});

// POST /:id/run — trigger an immediate run
schedulesRouter.post("/:id/run", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const schedule = db.select().from(schedules).where(eq(schedules.id, id)).get();
  if (!schedule) return res.status(404).json({ error: "Schedule not found" });

  try {
    const result = await executeScheduledRun(schedule);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
