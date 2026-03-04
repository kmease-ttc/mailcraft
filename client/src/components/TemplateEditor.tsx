import type { EmailTemplate } from "@shared/types";
import { Braces } from "lucide-react";

interface Props {
  columns: string[];
  template: EmailTemplate;
  onChange: (t: EmailTemplate) => void;
  onNext: () => void;
}

export function TemplateEditor({ columns, template, onChange, onNext }: Props) {
  const insertVariable = (col: string, field: "subject" | "bodyHtml") => {
    const tag = `{{${col}}}`;
    onChange({ ...template, [field]: template[field] + tag });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8">
      <h2 className="text-xl font-semibold mb-2">Email Template</h2>
      <p className="text-gray-500 text-sm mb-6">
        Use <code className="bg-gray-100 px-1 rounded">{"{{column_name}}"}</code> to insert data from your CSV.
      </p>

      {/* Variable chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {columns.map((col) => (
          <span
            key={col}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-full font-mono"
          >
            <Braces className="w-3 h-3" />
            {`{{${col}}}`}
          </span>
        ))}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subject Line
          </label>
          <input
            type="text"
            value={template.subject}
            onChange={(e) => onChange({ ...template, subject: e.target.value })}
            placeholder="e.g. Hi {{first_name}}, your report is ready"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Body (HTML)
          </label>
          <textarea
            value={template.bodyHtml}
            onChange={(e) =>
              onChange({ ...template, bodyHtml: e.target.value })
            }
            placeholder="<p>Hi {{first_name}},</p><p>Here are your results...</p>"
            rows={12}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-sm"
          />
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!template.subject || !template.bodyHtml}
        className="mt-6 px-6 py-2.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
      >
        Preview Emails
      </button>
    </div>
  );
}
