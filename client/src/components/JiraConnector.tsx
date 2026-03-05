import { useState, useEffect, useRef } from "react";
import type { CsvRow, JiraQueryResponse } from "@shared/types";
import { REPORT_SECTIONS, TEAM_CONFIGS, DEFAULT_TEAM_ID, buildSectionsForTeams, teamLabel as getTeamLabel } from "@shared/reportManifest";
import {
  Database,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  ChevronDown,
} from "lucide-react";

const LS_KEY = "mailcraft_jira_creds";

interface Props {
  onParsed: (rows: CsvRow[], columns: string[]) => void;
}

interface Creds {
  domain: string;
  email: string;
  apiToken: string;
}

export function JiraConnector({ onParsed }: Props) {
  const [creds, setCreds] = useState<Creds>({
    domain: "",
    email: "",
    apiToken: "",
  });
  const [saveCreds, setSaveCreds] = useState(true);
  const [showToken, setShowToken] = useState(false);

  // Team selection (multi)
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set([DEFAULT_TEAM_ID]));
  const teamIds = Array.from(selectedTeams);
  const sections = buildSectionsForTeams(teamIds);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const teamDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(e.target as Node)) {
        setTeamDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Connection state
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectedAs, setConnectedAs] = useState("");
  const [connError, setConnError] = useState("");

  // Query selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(sections.map((s) => s.id))
  );

  // Fetch state
  const [fetching, setFetching] = useState(false);
  const [fetchProgress, setFetchProgress] = useState("");
  const [fetchResult, setFetchResult] = useState<JiraQueryResponse | null>(
    null
  );
  const [fetchError, setFetchError] = useState("");

  // Load credentials: localStorage first, then server env defaults
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        setCreds(JSON.parse(saved));
        return;
      }
    } catch {}
    // Fall back to server-configured defaults
    fetch("/api/jira/defaults")
      .then((r) => r.json())
      .then((data) => {
        if (data.domain) setCreds(data);
      })
      .catch(() => {});
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setConnError("");
    setConnected(false);
    try {
      const res = await fetch("/api/jira/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentials: creds }),
      });
      const data = await res.json();
      if (data.ok) {
        setConnected(true);
        setConnectedAs(data.displayName || creds.email);
        if (saveCreds) localStorage.setItem(LS_KEY, JSON.stringify(creds));
      } else {
        setConnError(data.error || "Connection failed");
      }
    } catch (err: any) {
      setConnError(err.message);
    } finally {
      setTesting(false);
    }
  };

  const toggleTeam = (id: string) => {
    const next = new Set(selectedTeams);
    if (next.has(id)) {
      if (next.size > 1) next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedTeams(next);
    const newSections = buildSectionsForTeams(Array.from(next));
    setSelectedIds(new Set(newSections.map((s) => s.id)));
    setFetchResult(null);
  };

  const toggleAll = () => {
    if (selectedIds.size === sections.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sections.map((s) => s.id)));
    }
  };

  const toggleQuery = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleFetch = async () => {
    setFetching(true);
    setFetchError("");
    setFetchResult(null);
    setFetchProgress("Fetching data from JIRA...");
    try {
      const res = await fetch("/api/jira/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentials: creds,
          queryIds: Array.from(selectedIds),
          teamIds,
        }),
      });
      const data: JiraQueryResponse = await res.json();
      if (data.results) {
        setFetchResult(data);
        setFetchProgress("");
      } else {
        setFetchError("Unexpected response from server");
      }
    } catch (err: any) {
      setFetchError(err.message);
    } finally {
      setFetching(false);
    }
  };

  const handleUseData = () => {
    if (!fetchResult) return;
    const allRows = fetchResult.results.flatMap((r) => r.rows);
    onParsed(allRows, fetchResult.columns);
  };

  const credsValid = creds.domain && creds.email && creds.apiToken;

  return (
    <div className="space-y-6">
      {/* Credentials */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-500" />
          JIRA Connection
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              JIRA Domain
            </label>
            <input
              type="text"
              value={creds.domain}
              onChange={(e) => setCreds({ ...creds, domain: e.target.value })}
              placeholder="your-company.atlassian.net"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={creds.email}
              onChange={(e) => setCreds({ ...creds, email: e.target.value })}
              placeholder="you@company.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Token
            </label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={creds.apiToken}
                onChange={(e) =>
                  setCreds({ ...creds, apiToken: e.target.value })
                }
                placeholder="Your Atlassian API token"
                className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showToken ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Get one at id.atlassian.com/manage-profile/security/api-tokens
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={saveCreds}
              onChange={(e) => setSaveCreds(e.target.checked)}
              className="rounded border-gray-300"
            />
            Remember credentials in this browser
          </label>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleTestConnection}
            disabled={!credsValid || testing}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {testing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            Test Connection
          </button>

          {connected && (
            <span className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              Connected as {connectedAs}
            </span>
          )}
          {connError && (
            <span className="flex items-center gap-1.5 text-sm text-red-500">
              <XCircle className="w-4 h-4" />
              {connError}
            </span>
          )}
        </div>
      </div>

      {/* Team + Query selector - only after connection */}
      {connected && (
        <div>
          {/* Team multi-select dropdown */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teams / Projects
            </label>
            <div className="relative" ref={teamDropdownRef}>
              <button
                onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-left focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                <span className="text-sm text-gray-800 truncate">
                  {getTeamLabel(teamIds)}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 ml-2 transition-transform ${teamDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {teamDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                  {TEAM_CONFIGS.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTeams.has(t.id)}
                        onChange={() => toggleTeam(t.id)}
                        className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-800">{t.label}</span>
                        <span className="text-xs text-gray-400 ml-1.5">({t.projects.join(", ")})</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Select Queries</h3>
            <button
              onClick={toggleAll}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              {selectedIds.size === sections.length
                ? "Deselect All"
                : "Select All"}
            </button>
          </div>

          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {sections.map((s) => (
              <label
                key={s.id}
                className={`flex items-start gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedIds.has(s.id)
                    ? "border-indigo-200 bg-indigo-50/50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(s.id)}
                  onChange={() => toggleQuery(s.id)}
                  className="mt-0.5 rounded border-gray-300"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {s.query.label}
                  </p>
                  <p className="text-xs text-gray-500">{s.query.metrics}</p>
                </div>
              </label>
            ))}
          </div>

          <button
            onClick={handleFetch}
            disabled={selectedIds.size === 0 || fetching}
            className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {fetching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                Fetch from JIRA ({selectedIds.size} quer
                {selectedIds.size === 1 ? "y" : "ies"})
              </>
            )}
          </button>

          {fetchProgress && (
            <p className="mt-2 text-sm text-gray-500">{fetchProgress}</p>
          )}
          {fetchError && (
            <p className="mt-2 text-sm text-red-500">{fetchError}</p>
          )}
        </div>
      )}

      {/* Results */}
      {fetchResult && (
        <div className="border border-green-200 bg-green-50 rounded-lg p-5">
          <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Data Ready
          </h3>
          <div className="space-y-1 mb-4">
            {fetchResult.results.map((r) => (
              <div
                key={r.queryId}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-gray-700">{r.label}</span>
                <span
                  className={
                    r.error
                      ? "text-red-500"
                      : "text-green-700 font-medium"
                  }
                >
                  {r.error ? `Error: ${r.error}` : `${r.issueCount} issues`}
                </span>
              </div>
            ))}
          </div>
          <p className="text-sm text-green-700 font-medium mb-4">
            Total: {fetchResult.totalRows} rows across{" "}
            {fetchResult.columns.length} columns
          </p>
          <button
            onClick={handleUseData}
            className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Use This Data
          </button>
        </div>
      )}
    </div>
  );
}
