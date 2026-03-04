import { useState } from "react";
import type { CsvRow, EmailTemplate, SendEmailResult } from "@shared/types";
import { Send, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface Props {
  rows: CsvRow[];
  template: EmailTemplate;
  emailColumn: string;
}

export function SendPanel({ rows, template, emailColumn }: Props) {
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendEmailResult[] | null>(null);

  const handleSend = async () => {
    setSending(true);
    try {
      const recipients = rows.map((row) => ({
        email: row[emailColumn],
        data: row,
      }));

      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients, template, emailColumn }),
      });

      const data = await res.json();
      setResults(data.results);
    } catch {
      setResults(
        rows.map((r) => ({
          email: r[emailColumn],
          success: false,
          error: "Network error",
        }))
      );
    } finally {
      setSending(false);
    }
  };

  if (results) {
    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <h2 className="text-xl font-semibold mb-4">Results</h2>
        <div className="flex gap-6 mb-6">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">{sent} sent</span>
          </div>
          {failed > 0 && (
            <div className="flex items-center gap-2 text-red-500">
              <XCircle className="w-5 h-5" />
              <span className="font-medium">{failed} failed</span>
            </div>
          )}
        </div>

        <div className="space-y-1 max-h-80 overflow-y-auto">
          {results.map((r, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
                r.success ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50"
              }`}
            >
              {r.success ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 shrink-0" />
              )}
              <span className="font-mono">{r.email}</span>
              {r.error && (
                <span className="ml-auto text-xs text-red-500">{r.error}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
      <Send className="w-12 h-12 mx-auto text-indigo-400 mb-4" />
      <h2 className="text-xl font-semibold mb-2">
        Send {rows.length} email{rows.length !== 1 ? "s" : ""}
      </h2>
      <p className="text-gray-500 text-sm mb-6">
        Emails will be sent via Resend. Make sure your API key is configured.
      </p>
      <button
        onClick={handleSend}
        disabled={sending}
        className="inline-flex items-center gap-2 px-8 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-60 transition-colors font-medium text-lg"
      >
        {sending ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send className="w-5 h-5" />
            Send All
          </>
        )}
      </button>
    </div>
  );
}
