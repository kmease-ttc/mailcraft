import { useState } from "react";
import type { CsvRow, EmailTemplate } from "@shared/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  rows: CsvRow[];
  template: EmailTemplate;
  emailColumn: string;
  onNext: () => void;
  onBack: () => void;
}

function interpolate(tpl: string, data: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? "");
}

export function EmailPreview({
  rows,
  template,
  emailColumn,
  onNext,
  onBack,
}: Props) {
  const [index, setIndex] = useState(0);
  const row = rows[index];

  const subject = interpolate(template.subject, row);
  const body = interpolate(template.bodyHtml, row);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Preview</h2>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button
            onClick={() => setIndex(Math.max(0, index - 1))}
            disabled={index === 0}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>
            {index + 1} of {rows.length}
          </span>
          <button
            onClick={() => setIndex(Math.min(rows.length - 1, index + 1))}
            disabled={index === rows.length - 1}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <p className="text-xs text-gray-500">To</p>
          <p className="font-medium">{row[emailColumn]}</p>
        </div>
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <p className="text-xs text-gray-500">Subject</p>
          <p className="font-medium">{subject}</p>
        </div>
        <div
          className="p-6 prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: body }}
        />
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onBack}
          className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          Edit Template
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-medium"
        >
          Ready to Send ({rows.length} emails)
        </button>
      </div>
    </div>
  );
}
