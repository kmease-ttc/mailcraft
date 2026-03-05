import { Router } from "express";
import { db } from "../db/index.js";
import { fetchRuns } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";

export const fetchRunsRouter = Router();

// GET / — list recent fetch runs (no results_json)
fetchRunsRouter.get("/", (_req, res) => {
  const rows = db
    .select({
      id: fetchRuns.id,
      status: fetchRuns.status,
      queryIds: fetchRuns.queryIds,
      teamIds: fetchRuns.teamIds,
      totalRows: fetchRuns.totalRows,
      errorCount: fetchRuns.errorCount,
      triggeredBy: fetchRuns.triggeredBy,
      scheduleId: fetchRuns.scheduleId,
      createdAt: fetchRuns.createdAt,
    })
    .from(fetchRuns)
    .orderBy(desc(fetchRuns.createdAt))
    .limit(50)
    .all();

  res.json(
    rows.map((r) => ({ ...r, queryIds: JSON.parse(r.queryIds), teamIds: r.teamIds ? JSON.parse(r.teamIds) : null }))
  );
});

// GET /:id — get full fetch run with results
fetchRunsRouter.get("/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const row = db.select().from(fetchRuns).where(eq(fetchRuns.id, id)).get();
  if (!row) return res.status(404).json({ error: "Fetch run not found" });

  res.json({
    ...row,
    queryIds: JSON.parse(row.queryIds),
    teamIds: row.teamIds ? JSON.parse(row.teamIds) : null,
    results: JSON.parse(row.resultsJson),
  });
});
