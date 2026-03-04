import { useState } from "react";
import type { CsvRow } from "@shared/types";
import { CsvUploader } from "./CsvUploader";
import { JiraConnector } from "./JiraConnector";
import { Upload, Database } from "lucide-react";

interface Props {
  onParsed: (rows: CsvRow[], columns: string[]) => void;
}

export function DataSourcePicker({ onParsed }: Props) {
  const [source, setSource] = useState<"csv" | "jira">("jira");

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8">
      <h2 className="text-xl font-semibold mb-1">Choose Data Source</h2>
      <p className="text-gray-500 text-sm mb-6">
        Upload a CSV file or pull data directly from JIRA.
      </p>

      {/* Tab buttons */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setSource("csv")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            source === "csv"
              ? "border-indigo-500 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Upload className="w-4 h-4" />
          Upload CSV
        </button>
        <button
          onClick={() => setSource("jira")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            source === "jira"
              ? "border-indigo-500 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Database className="w-4 h-4" />
          JIRA Connector
        </button>
      </div>

      {source === "csv" ? (
        <CsvUploader onParsed={onParsed} />
      ) : (
        <JiraConnector onParsed={onParsed} />
      )}
    </div>
  );
}
