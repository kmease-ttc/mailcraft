import { EMAIL_TEMPLATES, type EmailDef } from "@shared/emailTemplates";
import { Mail, ChevronRight } from "lucide-react";

interface Props {
  onSelect: (email: EmailDef) => void;
}

export function EmailList({ onSelect }: Props) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Metric Emails</h2>
        <p className="text-sm text-gray-500">
          {EMAIL_TEMPLATES.length} pre-built emails. Click to preview, edit, fetch data, and send.
        </p>
      </div>

      <div className="space-y-2">
        {EMAIL_TEMPLATES.map((email) => (
          <button
            key={email.id}
            onClick={() => onSelect(email)}
            className="w-full flex items-center gap-4 px-5 py-4 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {email.subject}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Query: {email.queryId} &middot; {email.tableColumns.length} columns in table
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
