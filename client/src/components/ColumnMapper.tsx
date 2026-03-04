import { Mail } from "lucide-react";

interface Props {
  columns: string[];
  emailColumn: string;
  onSelect: (column: string) => void;
}

export function ColumnMapper({ columns, emailColumn, onSelect }: Props) {
  // Auto-detect likely email columns
  const suggested = columns.find((c) =>
    /email|e-mail|mail/i.test(c)
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8">
      <h2 className="text-xl font-semibold mb-2">Map Email Column</h2>
      <p className="text-gray-500 text-sm mb-6">
        Select the column that contains recipient email addresses.
      </p>

      <div className="grid gap-2">
        {columns.map((col) => (
          <button
            key={col}
            onClick={() => onSelect(col)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
              col === emailColumn
                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                : col === suggested
                  ? "border-indigo-200 bg-indigo-50/50 hover:border-indigo-400"
                  : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <Mail className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="font-medium">{col}</span>
            {col === suggested && (
              <span className="ml-auto text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                Suggested
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
