import "dotenv/config";
import express from "express";
import { emailRouter } from "./routes/email.js";
import { jiraRouter } from "./routes/jira.js";
import { reportsRouter } from "./routes/reports.js";
import { fetchRunsRouter } from "./routes/fetchRuns.js";
import { schedulesRouter } from "./routes/schedules.js";
import { initializeDatabase } from "./db/index.js";
import { initializeScheduler } from "./services/scheduler.js";

const app = express();
app.use(express.json({ limit: "10mb" }));

// Initialize database (creates tables if not exist)
initializeDatabase();

// Mount routes
app.use("/api/email", emailRouter);
app.use("/api/jira", jiraRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/fetch-runs", fetchRunsRouter);
app.use("/api/schedules", schedulesRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Mailcraft API running on http://localhost:${PORT}`);
  initializeScheduler();
});
