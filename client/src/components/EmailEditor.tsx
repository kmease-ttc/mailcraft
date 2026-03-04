import { useState, useMemo } from "react";
import type { EmailDef } from "@shared/emailTemplates";
import type { CsvRow, JiraQueryResponse } from "@shared/types";
import {
  ArrowLeft,
  Database,
  Loader2,
  Send,
  CheckCircle,
  XCircle,
  Pencil,
  Eye,
} from "lucide-react";

interface Props {
  email: EmailDef;
  onBack: () => void;
}

function buildDataTable(rows: CsvRow[], columns: string[]): string {
  if (!rows.length) return "<p><em>No data — fetch from JIRA first.</em></p>";

  const ths = columns.map((c) => `<th>${c}</th>`).join("");
  const trs = rows
    .map(
      (row) =>
        `<tr>${columns.map((c) => `<td>${row[c] || ""}</td>`).join("")}</tr>`
    )
    .join("");

  return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

function renderEmail(
  bodyHtml: string,
  rows: CsvRow[],
  tableColumns: string[]
): string {
  const table = buildDataTable(rows, tableColumns);
  return bodyHtml
    .replace("{{DATA_TABLE}}", table)
    .replace("{{issueCount}}", String(rows.length))
    .replace("{{date}}", new Date().toLocaleDateString());
}

export function EmailEditor({ email, onBack }: Props) {
  const [subject, setSubject] = useState(email.subject);
  const [bodyHtml, setBodyHtml] = useState(email.bodyHtml);
  const [recipients, setRecipients] = useState(email.recipients);
  const [mode, setMode] = useState<"preview" | "edit">("preview");

  // JIRA data
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // Send state
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");

  const renderedHtml = useMemo(
    () => renderEmail(bodyHtml, rows, email.tableColumns),
    [bodyHtml, rows, email.tableColumns]
  );

  const handleFetch = async () => {
    setFetching(true);
    setFetchError("");
    try {
      // Get credentials from defaults
      const credsRes = await fetch("/api/jira/defaults");
      const creds = await credsRes.json();

      const res = await fetch("/api/jira/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentials: creds,
          queryIds: [email.queryId],
        }),
      });
      const data: JiraQueryResponse = await res.json();

      if (data.results?.[0]) {
        const result = data.results[0];
        if (result.error) {
          setFetchError(result.error);
        } else {
          setRows(result.rows);
          setFetched(true);
        }
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
      const finalHtml = renderedHtml;

      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: toList.map((addr) => ({ email: addr, data: {} })),
          template: { subject, bodyHtml: finalHtml },
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900">{subject}</h2>
          <p className="text-xs text-gray-500">
            {fetched
              ? `${rows.length} issues loaded`
              : "No data loaded yet"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMode(mode === "preview" ? "edit" : "preview")}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {mode === "preview" ? (
              <>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" /> Preview
              </>
            )}
          </button>
          <button
            onClick={handleFetch}
            disabled={fetching}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {fetching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Database className="w-3.5 h-3.5" />
            )}
            {fetching ? "Fetching..." : fetched ? "Refresh Data" : "Fetch Data"}
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          <XCircle className="w-4 h-4 shrink-0" />
          {fetchError}
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

      {/* Subject (editable) */}
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

      {/* Body: preview or edit */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {mode === "edit" ? (
          <textarea
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            className="w-full p-4 font-mono text-sm outline-none min-h-[500px] resize-y"
          />
        ) : (
          <div
            className="p-6"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        )}
      </div>

      {/* Send */}
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
            {sending ? "Sending..." : "Send Email"}
          </button>
        )}
        {sendError && (
          <span className="text-sm text-red-500">{sendError}</span>
        )}
      </div>
    </div>
  );
}
