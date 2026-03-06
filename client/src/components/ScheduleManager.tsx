import { useState, useEffect, useRef } from "react";
import type { ScheduleRecord, CreateScheduleRequest } from "@shared/types";
import { TEAM_CONFIGS, DEFAULT_TEAM_ID, teamLabel as getTeamLabel } from "@shared/reportManifest";
import {
  Clock,
  Plus,
  Trash2,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  X,
  ChevronDown,
} from "lucide-react";

const CRON_PRESETS = [
  { label: "Every Monday 9am", value: "0 9 * * 1" },
  { label: "Every weekday 8am", value: "0 8 * * 1-5" },
  { label: "1st of month 9am", value: "0 9 1 * *" },
  { label: "Every Friday 5pm", value: "0 17 * * 5" },
];

function cronToHuman(expr: string): string {
  const preset = CRON_PRESETS.find((p) => p.value === expr);
  if (preset) return preset.label;
  return expr;
}

export function ScheduleManager() {
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [runResult, setRunResult] = useState<string>("");

  // Form state
  const [name, setName] = useState("");
  const [cronExpr, setCronExpr] = useState("0 9 * * 1");
  const [recipients, setRecipients] = useState("");
  const [subjectOverride, setSubjectOverride] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string>(DEFAULT_TEAM_ID);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const teamDropdownRef = useRef<HTMLDivElement>(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(e.target as Node)) {
        setTeamDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSchedules = () => {
    fetch("/api/schedules")
      .then((r) => r.json())
      .then((data) => setSchedules(data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleCreate = async () => {
    if (!name.trim() || !cronExpr.trim() || !recipients.trim()) {
      setFormError("Name, cron expression, and recipients are required");
      return;
    }
    setSubmitting(true);
    setFormError("");

    const body: CreateScheduleRequest = {
      name: name.trim(),
      cronExpr: cronExpr.trim(),
      recipients: recipients.trim(),
      subject: subjectOverride.trim() || undefined,
      teamIds: [selectedTeam],
    };

    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) {
        setFormError(data.error);
      } else {
        setShowForm(false);
        resetForm();
        fetchSchedules();
      }
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/schedules/${id}`, { method: "DELETE" });
    fetchSchedules();
  };

  const handleToggleEnabled = async (schedule: ScheduleRecord) => {
    await fetch(`/api/schedules/${schedule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !schedule.enabled }),
    });
    fetchSchedules();
  };

  const handleRunNow = async (id: number) => {
    setRunningId(id);
    setRunResult("");
    try {
      const res = await fetch(`/api/schedules/${id}/run`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setRunResult(`Error: ${data.error}`);
      } else {
        setRunResult(
          `Done: ${data.emailsSent} sent, ${data.emailsFailed} failed`
        );
        fetchSchedules();
      }
    } catch (err: any) {
      setRunResult(`Error: ${err.message}`);
    } finally {
      setRunningId(null);
    }
  };

  const resetForm = () => {
    setName("");
    setCronExpr("0 9 * * 1");
    setRecipients("");
    setSubjectOverride("");
    setSelectedTeam(DEFAULT_TEAM_ID);
    setFormError("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading schedules...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Report Schedules
          </h2>
          <p className="text-sm text-gray-500">
            Automatically generate and email reports on a schedule
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          New Schedule
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">New Schedule</h3>
            <button
              onClick={() => setShowForm(false)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Schedule Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Weekly Monday Report"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Schedule (cron expression)
            </label>
            <div className="flex gap-2 mb-2">
              {CRON_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setCronExpr(preset.value)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    cronExpr === preset.value
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={cronExpr}
              onChange={(e) => setCronExpr(e.target.value)}
              placeholder="0 9 * * 1"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Recipients (comma-separated)
            </label>
            <input
              type="text"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="stakeholder@company.com, manager@company.com"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Subject Override (optional)
            </label>
            <input
              type="text"
              value={subjectOverride}
              onChange={(e) => setSubjectOverride(e.target.value)}
              placeholder="Leave blank for default subject"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Team / Project
            </label>
            <div className="relative" ref={teamDropdownRef}>
              <button
                type="button"
                onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg bg-white text-left text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
              >
                <span className="text-gray-800 truncate">
                  {getTeamLabel([selectedTeam])}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 ml-2 transition-transform ${teamDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {teamDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                  {TEAM_CONFIGS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTeam(t.id);
                        setTeamDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer text-left ${
                        selectedTeam === t.id ? "bg-indigo-50" : ""
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${selectedTeam === t.id ? "bg-indigo-500" : "bg-gray-300"}`} />
                      <div>
                        <span className="text-sm font-medium text-gray-800">{t.label}</span>
                        <span className="text-xs text-gray-400 ml-1.5">({t.projects.join(", ")})</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-500">{formError}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors font-medium"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {submitting ? "Creating..." : "Create Schedule"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Schedule list */}
      {schedules.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Clock className="w-12 h-12 mb-3" />
          <p className="text-lg font-medium">No schedules</p>
          <p className="text-sm">
            Create a schedule to automatically send reports
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              className="bg-white border border-gray-200 rounded-lg px-5 py-4 flex items-center gap-4"
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  schedule.enabled ? "bg-green-100" : "bg-gray-100"
                }`}
              >
                <Clock
                  className={`w-5 h-5 ${
                    schedule.enabled ? "text-green-600" : "text-gray-400"
                  }`}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{schedule.name}</p>
                  {!schedule.enabled && (
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                      Paused
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {schedule.teamIds && schedule.teamIds.length > 0
                    ? getTeamLabel(schedule.teamIds)
                    : "All teams"}{" "}
                  &middot; {cronToHuman(schedule.cronExpr)} &middot;{" "}
                  {schedule.recipients}
                  {schedule.lastRunAt && (
                    <>
                      {" "}
                      &middot; Last run:{" "}
                      {new Date(schedule.lastRunAt).toLocaleDateString()}
                      {schedule.lastRunStatus === "success" ? (
                        <CheckCircle className="w-3 h-3 inline ml-1 text-green-500" />
                      ) : schedule.lastRunStatus === "error" ? (
                        <XCircle className="w-3 h-3 inline ml-1 text-red-500" />
                      ) : null}
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Toggle enabled */}
                <button
                  onClick={() => handleToggleEnabled(schedule)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                    schedule.enabled
                      ? "border-green-200 text-green-700 hover:bg-green-50"
                      : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {schedule.enabled ? "Enabled" : "Enable"}
                </button>

                {/* Run now */}
                <button
                  onClick={() => handleRunNow(schedule.id)}
                  disabled={runningId === schedule.id}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {runningId === schedule.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                  Run Now
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(schedule.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Run result */}
      {runResult && (
        <div
          className={`px-4 py-2 rounded-lg text-sm ${
            runResult.startsWith("Error")
              ? "bg-red-50 text-red-600"
              : "bg-green-50 text-green-600"
          }`}
        >
          {runResult}
        </div>
      )}
    </div>
  );
}
