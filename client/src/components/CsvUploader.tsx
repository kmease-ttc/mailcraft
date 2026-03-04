import { useCallback, useState } from "react";
import Papa from "papaparse";
import type { CsvRow } from "@shared/types";
import { Upload } from "lucide-react";

interface Props {
  onParsed: (rows: CsvRow[], columns: string[]) => void;
}

export function CsvUploader({ onParsed }: Props) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const handleFile = useCallback(
    (file: File) => {
      setError("");
      Papa.parse<CsvRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          if (result.errors.length) {
            setError(`Parse error: ${result.errors[0].message}`);
            return;
          }
          if (!result.data.length) {
            setError("CSV is empty");
            return;
          }
          const columns = Object.keys(result.data[0]);
          onParsed(result.data, columns);
        },
        error: (err) => setError(err.message),
      });
    },
    [onParsed]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
      className={`border-2 border-dashed rounded-xl p-16 text-center transition-colors ${
        dragging
          ? "border-indigo-400 bg-indigo-50"
          : "border-gray-300 bg-white"
      }`}
    >
      <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
      <p className="text-lg font-medium text-gray-700 mb-2">
        Drag & drop your CSV file here
      </p>
      <p className="text-sm text-gray-500 mb-4">or click to browse</p>
      <input
        type="file"
        accept=".csv"
        className="hidden"
        id="csv-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <label
        htmlFor="csv-input"
        className="inline-block px-6 py-2.5 bg-indigo-500 text-white rounded-lg cursor-pointer hover:bg-indigo-600 transition-colors font-medium"
      >
        Choose File
      </label>
      {error && <p className="mt-4 text-red-500 text-sm">{error}</p>}
    </div>
  );
}
