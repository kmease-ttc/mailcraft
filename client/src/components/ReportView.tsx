import { useState, useRef, useEffect } from "react";
import type { JiraQueryResponse, JiraQueryResult } from "@shared/types";
import { TEAM_CONFIGS, DEFAULT_TEAM_ID, buildSectionsForTeams, teamLabel as getTeamLabel } from "@shared/reportManifest";
import { buildFullReport } from "../lib/reportBuilder";
import {
  Database,
  Download,
  Loader2,
  Send,
  CheckCircle,
  XCircle,
  Pencil,
  Eye,
  RefreshCw,
  Save,
  ChevronDown,
} from "lucide-react";

export function ReportView() {
  // Team (single-select)
  const [selectedTeam, setSelectedTeam] = useState<string>(DEFAULT_TEAM_ID);
  const teamIds = [selectedTeam];
  const currentTeamLabel = getTeamLabel(teamIds);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const teamDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(e.target as Node)) {
        setTeamDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectTeam = (id: string) => {
    setSelectedTeam(id);
    setTeamDropdownOpen(false);
    setFetched(false);
    setResults([]);
    setSavedReportId(null);
  };

  // Data
  const [results, setResults] = useState<JiraQueryResult[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [fetchRunId, setFetchRunId] = useState<number | null>(null);

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

  // Save state
  const [saving, setSaving] = useState(false);
  const [savedReportId, setSavedReportId] = useState<number | null>(null);

  const sections = buildSectionsForTeams(teamIds);
  const queryIds = sections.map((s) => s.id);

  const reportHtml = fetched ? buildFullReport(results, currentTeamLabel) : "";
  const displayHtml = customHtml || reportHtml;

  const handleFetchAll = async () => {
    setFetching(true);
    setFetchError("");
    setSavedReportId(null);
    setSent(false);
    try {
      const credsRes = await fetch("/api/jira/defaults");
      const creds = await credsRes.json();

      if (!creds.domain) {
        setFetchError("No JIRA credentials configured. Add them to .env");
        setFetching(false);
        return;
      }

      const res = await fetch("/api/jira/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentials: creds, queryIds, teamIds }),
      });
      const data: JiraQueryResponse = await res.json();

      if (data.results) {
        setResults(data.results);
        setFetched(true);
        setCustomHtml("");
        if (data.fetchRunId) setFetchRunId(data.fetchRunId);
      } else {
        setFetchError("Unexpected response");
      }
    } catch (err: any) {
      setFetchError(err.message);
    } finally {
      setFetching(false);
    }
  };

  const handleSaveReport = async () => {
    if (!fetchRunId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fetchRunId,
          subject,
          bodyHtml: displayHtml,
          reportMeta: {
            totalIssues: results.reduce((s, r) => s + r.issueCount, 0),
            queryCount: results.length,
            errorCount: results.filter((r) => r.error).length,
          },
        }),
      });
      const data = await res.json();
      if (data.id) setSavedReportId(data.id);
    } catch {
      // silently fail for now
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!recipients.trim()) {
      setSendError("Add at least one recipient");
      return;
    }
    setSending(true);
    setSendError("");

    // Auto-save report before sending if not saved yet
    let reportId = savedReportId;
    if (!reportId && fetchRunId) {
      try {
        const saveRes = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fetchRunId,
            subject,
            bodyHtml: displayHtml,
            reportMeta: {
              totalIssues: results.reduce((s, r) => s + r.issueCount, 0),
              queryCount: results.length,
              errorCount: results.filter((r) => r.error).length,
            },
          }),
        });
        const saveData = await saveRes.json();
        if (saveData.id) {
          reportId = saveData.id;
          setSavedReportId(saveData.id);
        }
      } catch {
        // continue with send even if save fails
      }
    }

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
          reportId,
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

  const handleDownload = () => {
    const blob = new Blob([displayHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `sdlc-metrics-report-${dateStr}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalIssues = results.reduce((s, r) => s + r.issueCount, 0);
  const queryErrors = results.filter((r) => r.error).length;

  return (
    <div className="space-y-4">
      {/* Header + Actions */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">
            SDLC Metrics Report
          </h2>
          <p className="text-sm text-white/50">
            {fetched
              ? `${totalIssues} total issues across ${results.length} queries${queryErrors ? ` (${queryErrors} errors)` : ""}`
              : "Fetch data from JIRA to generate the report"}
          </p>
        </div>

        <div className="flex gap-2 shrink-0 items-center">
          {/* Team selector */}
          <div className="relative" ref={teamDropdownRef}>
            <button
              onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-white/10 text-white border border-white/20 rounded-lg outline-none backdrop-blur-sm hover:bg-white/15 transition-colors min-w-[160px]"
            >
              <span className="truncate">{currentTeamLabel}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-white/50 shrink-0 transition-transform ${teamDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {teamDropdownOpen && (
              <div className="absolute right-0 z-50 mt-1 w-56 bg-gray-900 border border-white/15 rounded-lg shadow-xl py-1">
                {TEAM_CONFIGS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => selectTeam(t.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 cursor-pointer text-left ${
                      selectedTeam === t.id ? "bg-white/10" : ""
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${selectedTeam === t.id ? "bg-indigo-400" : "bg-white/20"}`} />
                    <span className="text-sm text-white/80">{t.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {fetched && (
            <button
              onClick={() => setMode(mode === "preview" ? "edit" : "preview")}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm glass-card-hover text-white/70 hover:text-white transition-colors"
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
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-500/80 backdrop-blur-sm text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors font-medium border border-indigo-400/30"
          >
            {fetching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Fetching all {queryIds.length} queries...
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
        <div className="flex items-center gap-2 px-4 py-3 glass-card bg-red-500/10 border-red-400/20 text-sm text-red-300">
          <XCircle className="w-4 h-4 shrink-0" />
          {fetchError}
        </div>
      )}

      {/* Query status grid (shown while/after fetching) */}
      {fetched && (
        <div className="grid grid-cols-2 gap-2">
          {results.map((r) => (
            <div
              key={r.queryId}
              className={`flex items-center justify-between px-3 py-3 glass-card min-h-[44px] text-xs ${
                r.error
                  ? "bg-red-500/10 border-red-400/20 text-red-300"
                  : "text-white/70"
              }`}
            >
              <span className="truncate">{r.metrics}</span>
              <span className="font-semibold ml-2 shrink-0 text-white">
                {r.error ? "Error" : `${r.issueCount}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Recipients */}
      <div className="glass-input px-4 py-3">
        <label className="block text-xs font-medium text-white/40 mb-1">
          To (comma-separated)
        </label>
        <input
          type="text"
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
          placeholder="stakeholder@company.com, manager@company.com"
          className="w-full text-sm outline-none bg-transparent text-white placeholder:text-white/30"
        />
      </div>

      {/* Subject */}
      <div className="glass-input px-4 py-3">
        <label className="block text-xs font-medium text-white/40 mb-1">
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full text-sm font-medium outline-none bg-transparent text-white"
        />
      </div>

      {/* Email body */}
      <div className="glass-card overflow-hidden">
        {!fetched ? (
          <div className="flex flex-col items-center justify-center py-24 text-white/30">
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
            className="w-full p-4 font-mono text-xs outline-none min-h-[600px] resize-y bg-transparent text-white/80"
          />
        ) : (
          <div
            className="p-2 bg-white rounded-xl"
            dangerouslySetInnerHTML={{ __html: displayHtml }}
          />
        )}
      </div>

      {/* Actions: Save + Send */}
      {fetched && (
        <div className="flex items-center gap-3">
          {/* Save Report */}
          {savedReportId ? (
            <div className="flex items-center gap-1.5 text-sm text-white/50">
              <CheckCircle className="w-4 h-4 text-green-400" />
              Saved
            </div>
          ) : (
            <button
              onClick={handleSaveReport}
              disabled={saving || !fetchRunId}
              className="inline-flex items-center gap-2 px-4 py-2.5 glass-card-hover disabled:opacity-40 transition-colors text-sm font-medium text-white/70 hover:text-white"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? "Saving..." : "Save Report"}
            </button>
          )}


          {/* Download */}
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-4 py-2.5 glass-card-hover transition-colors text-sm font-medium text-white/70 hover:text-white"
          >
            <Download className="w-4 h-4" />
            Download HTML
          </button>
          {/* Send */}
          {sent ? (
            <div className="flex items-center gap-2 text-green-400 font-medium">
              <CheckCircle className="w-5 h-5" />
              Sent successfully!
            </div>
          ) : (
            <button
              onClick={handleSend}
              disabled={sending || !recipients.trim()}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-500/80 backdrop-blur-sm text-white rounded-lg hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium border border-indigo-400/30"
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
            <span className="text-sm text-red-400">{sendError}</span>
          )}
        </div>
      )}
    </div>
  );
}
