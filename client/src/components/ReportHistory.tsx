import { useState, useEffect } from "react";
import type { ReportRecord, EmailLogRecord } from "@shared/types";
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Mail,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";

export function ReportHistory() {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedHtml, setExpandedHtml] = useState("");
  const [emailLog, setEmailLog] = useState<EmailLogRecord[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((data) => setReports(data))
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }

    setLoadingDetail(true);
    setExpandedId(id);

    const [reportRes, emailsRes] = await Promise.all([
      fetch(`/api/reports/${id}`),
      fetch(`/api/reports/${id}/emails`),
    ]);
    const report = await reportRes.json();
    const emails = await emailsRes.json();

    setExpandedHtml(report.bodyHtml || "");
    setEmailLog(emails);
    setLoadingDetail(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading reports...
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <FileText className="w-12 h-12 mb-3" />
        <p className="text-lg font-medium">No reports saved yet</p>
        <p className="text-sm">
          Generate and save a report from the "New Report" tab
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-gray-900">Report History</h2>
      <p className="text-sm text-gray-500">{reports.length} saved reports</p>

      {reports.map((report) => {
        const isExpanded = expandedId === report.id;
        const meta = report.reportMeta;
        const date = new Date(report.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });

        return (
          <div
            key={report.id}
            className="bg-white border border-gray-200 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => toggleExpand(report.id)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {report.subject}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {date}
                  {meta
                    ? ` — ${meta.totalIssues} issues, ${meta.queryCount} queries`
                    : ""}
                </p>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
              )}
            </button>

            {isExpanded && (
              <div className="border-t border-gray-200">
                {loadingDetail ? (
                  <div className="flex items-center justify-center py-8 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Loading...
                  </div>
                ) : (
                  <>
                    {/* Email log */}
                    {emailLog.length > 0 && (
                      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-2">
                          <Mail className="w-3.5 h-3.5 inline mr-1" />
                          Email Log ({emailLog.length})
                        </p>
                        <div className="space-y-1">
                          {emailLog.map((log) => (
                            <div
                              key={log.id}
                              className="flex items-center gap-2 text-xs"
                            >
                              {log.status === "sent" ? (
                                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-red-500" />
                              )}
                              <span className="text-gray-700">
                                {log.recipient}
                              </span>
                              <span className="text-gray-400">
                                {new Date(log.sentAt).toLocaleString()}
                              </span>
                              {log.error && (
                                <span className="text-red-500">
                                  {log.error}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Report HTML preview */}
                    <div
                      className="p-2"
                      dangerouslySetInnerHTML={{ __html: expandedHtml }}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
