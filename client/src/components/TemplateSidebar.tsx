import { useState } from "react";
import {
  REPORT_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type ReportTemplateEntry,
} from "@shared/templateRegistry";
import {
  BarChart3,
  Zap,
  FileText,
  Search,
  LayoutDashboard,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  BarChart3,
  Zap,
  FileText,
  LayoutDashboard,
};

interface Props {
  selectedId: string | null;
  onSelect: (template: ReportTemplateEntry) => void;
}

export function TemplateSidebar({ selectedId, onSelect }: Props) {
  const [search, setSearch] = useState("");

  const filtered = REPORT_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = TEMPLATE_CATEGORIES.map((cat) => ({
    ...cat,
    templates: filtered.filter((t) => t.category === cat.id),
  })).filter((g) => g.templates.length > 0);

  return (
    <aside className="w-72 shrink-0 flex flex-col h-full border-r border-white/10">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider">
          Templates
        </h2>
      </div>

      {/* Search */}
      <div className="px-3 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-8 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 outline-none focus:border-indigo-400/50 transition-colors"
          />
        </div>
      </div>

      {/* Template list */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
        {grouped.map((group) => (
          <div key={group.id}>
            <p className="text-[11px] font-medium text-white/30 uppercase tracking-wider px-2 mb-1.5">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.templates.map((template) => {
                const Icon = ICON_MAP[template.icon] || FileText;
                const isActive = selectedId === template.id;

                return (
                  <button
                    key={template.id}
                    onClick={() => onSelect(template)}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      isActive
                        ? "bg-indigo-500/20 border border-indigo-400/30 text-white"
                        : "text-white/60 hover:bg-white/5 hover:text-white/80 border border-transparent"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        isActive ? "text-indigo-400" : "text-white/40"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {template.name}
                      </p>
                      <p
                        className={`text-xs mt-0.5 line-clamp-2 ${
                          isActive ? "text-white/50" : "text-white/30"
                        }`}
                      >
                        {template.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-white/30 text-sm">
            No templates match "{search}"
          </div>
        )}
      </nav>
    </aside>
  );
}
