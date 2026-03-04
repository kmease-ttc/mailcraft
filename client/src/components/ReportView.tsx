import { useState } from "react";
import type { JiraQueryResponse, JiraQueryResult } from "@shared/types";
import { buildFullReport } from "../lib/reportBuilder";
import {
  Database,
  Loader2,
  Send,
  CheckCircle,
  XCircle,
  Pencil,
  Eye,
  RefreshCw,
} from "lucide-react";

export function ReportView() {
  // Data
  const [results, setResults] = useState<JiraQueryResult[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // Email fields
  const [subject, setSubject] = useState(
    `SDLC Performance Metrics — ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`
  );
  const [recipients, setRecipients] = useState("");
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [customHtml, setCustomHtml] = useState("");

  // Send state
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");

  const reportHtml = fetched ? buildFullReport(results) : "";
  const displayHtml = customHtml || reportHtml;

  const handleFetchAll = async () => {
    setFetching(true);
    setFetchError("");
    try {
      const credsRes = await fetch("/api/jira/defaults");
      const creds = await credsRes.json();

      if (!creds.domain) {
        setFetchError("No JIRA credentials configured. Add them to .env");
        setFetching(false);
        return;
      }

      const queryIds = [
        "throughput",
        "velocity",
        "cycle_time",
        "wip",
        "backlog_readiness",
        "all_bugs",
        "prod_bugs",
        "regressions",
        "rework",
        "unplanned_work",
        "discovery",
        "blocked",
        "aging_backlog",
      ];

      const res = await fetch("/api/jira/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentials: creds, queryIds }),
      });
      const data: JiraQueryResponse = await res.json();

      if (data.results) {
        setResults(data.results);
        setFetched(true);
        setCustomHtml(""); // reset any edits so it regenerates
      } else {
        setFetchError("Unexpected response");
      }
    } catch (err: any) {
      setFetchError(err.message);
    } finally {
      setFetching(false);
    }
  };

  const handleSend = async () => {
    if (!recipients.trim()) {
      setSendError("Add at least one recipient");
      return;
    }
    setSending(true);
    setSendError("");
    try {
      const toList = recipients
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: toList.map((addr) => ({ email: addr, data: {} })),
          template: { subject, bodyHtml: displayHtml },
          emailColumn: "email",
        }),
      });
      const data = await res.json();
      if (data.sent > 0) {
        setSent(true);
      } else {
        setSendError(data.results?.[0]?.error || "Send failed");
      }
    } catch (err: any) {
      setSendError(err.message);
    } finally {
      setSending(false);
    }
  };

  const totalIssues = results.reduce((s, r) => s + r.issueCount, 0);
  const queryErrors = results.filter((r) => r.error).length;

  return (
    <div className="space-y-4">
      {/* Header + Actions */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            SDLC Metrics Report
          </h2>
          <p className="text-sm text-gray-500">
            {fetched
              ? `${totalIssues} total issues across ${results.length} queries${queryErrors ? ` (${queryErrors} errors)` : ""}`
              : "Fetch data from JIRA to generate the report"}
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          {fetched && (
            <button
              onClick={() => setMode(mode === "preview" ? "edit" : "preview")}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {mode === "preview" ? (
                <>
                  <Pencil className="w-3.5 h-3.5" /> Edit HTML
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" /> Preview
                </>
              )}
            </button>
          )}
          <button
            onClick={handleFetchAll}
            disabled={fetching}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors font-medium"
          >
            {fetching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Fetching all 13 queries...
              </>
            ) : fetched ? (
              <>
                <RefreshCw className="w-4 h-4" />
                Refresh Data
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                Fetch All Data
              </>
            )}
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          <XCircle className="w-4 h-4 shrink-0" />
          {fetchError}
        </div>
      )}

      {/* Query status grid (shown while/after fetching) */}
      {fetched && (
        <div className="grid grid-cols-2 gap-1.5">
          {results.map((r) => (
            <div
              key={r.queryId}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                r.error
                  ? "bg-red-50 text-red-700"
                  : "bg-gray-50 text-gray-700"
              }`}
            >
              <span className="truncate">{r.metrics}</span>
              <span className="font-semibold ml-2 shrink-0">
                {r.error ? "Error" : `${r.issueCount}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Recipients */}
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          To (comma-separated)
        </label>
        <input
          type="text"
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
          placeholder="stakeholder@company.com, manager@company.com"
          className="w-full text-sm outline-none"
        />
      </div>

      {/* Subject */}
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full text-sm font-medium outline-none"
        />
      </div>

      {/* Email body */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {!fetched ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Database className="w-12 h-12 mb-3" />
            <p className="text-lg font-medium">No data yet</p>
            <p className="text-sm">
              Click "Fetch All Data" to pull metrics from JIRA
            </p>
          </div>
        ) : mode === "edit" ? (
          <textarea
            value={customHtml || reportHtml}
            onChange={(e) => setCustomHtml(e.target.value)}
            className="w-full p-4 font-mono text-xs outline-none min-h-[600px] resize-y"
          />
        ) : (
          <div
            className="p-2"
            dangerouslySetInnerHTML={{ __html: displayHtml }}
          />
        )}
      </div>

      {/* Send */}
      {fetched && (
        <div className="flex items-center gap-3">
          {sent ? (
            <div className="flex items-center gap-2 text-green-600 font-medium">
              <CheckCircle className="w-5 h-5" />
              Sent successfully!
            </div>
          ) : (
            <button
              onClick={handleSend}
              disabled={sending || !recipients.trim()}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {sending ? "Sending..." : "Send Report"}
            </button>
          )}
          {sendError && (
            <span className="text-sm text-red-500">{sendError}</span>
          )}
        </div>
      )}
    </div>
  );
}
