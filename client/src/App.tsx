import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { TemplateSidebar } from "./components/TemplateSidebar";
import { ReportView } from "./components/ReportView";
import { ReportHistory } from "./components/ReportHistory";
import { ScheduleManager } from "./components/ScheduleManager";
import type { ReportTemplateEntry } from "@shared/templateRegistry";
import { BarChart3, Mail, Plus } from "lucide-react";

function TemplateHome() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center mb-6">
        <Mail className="w-8 h-8 text-indigo-400" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">
        Welcome to MRI Software
      </h2>
      <p className="text-white/50 max-w-md mb-8">
        Select a report template from the sidebar to get started, or create a
        new custom template.
      </p>
      <div className="glass-card p-6 max-w-sm w-full text-left">
        <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          Quick Start
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm text-white/60">
            <BarChart3 className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              <span className="text-white/80 font-medium">SDLC Metrics</span>{" "}
              — pull JIRA data and generate formatted reports
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-white/40">
            <Plus className="w-4 h-4 shrink-0" />
            <span>More templates coming soon</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateWorkspace({ template }: { template: ReportTemplateEntry }) {
  switch (template.componentKey) {
    case "sdlc-metrics":
      return (
        <Tabs.Root defaultValue="report">
          <Tabs.List className="flex gap-1 mb-6 border-b border-white/10">
            <Tabs.Trigger
              value="report"
              className="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px data-[state=active]:border-indigo-400 data-[state=active]:text-indigo-300 border-transparent text-white/50 hover:text-white/70 transition-colors"
            >
              New Report
            </Tabs.Trigger>
            <Tabs.Trigger
              value="history"
              className="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px data-[state=active]:border-indigo-400 data-[state=active]:text-indigo-300 border-transparent text-white/50 hover:text-white/70 transition-colors"
            >
              History
            </Tabs.Trigger>
            <Tabs.Trigger
              value="schedules"
              className="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px data-[state=active]:border-indigo-400 data-[state=active]:text-indigo-300 border-transparent text-white/50 hover:text-white/70 transition-colors"
            >
              Schedules
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content
            value="report"
            forceMount
            className="data-[state=inactive]:hidden"
          >
            <ReportView />
          </Tabs.Content>
          <Tabs.Content
            value="history"
            forceMount
            className="data-[state=inactive]:hidden"
          >
            <ReportHistory />
          </Tabs.Content>
          <Tabs.Content
            value="schedules"
            forceMount
            className="data-[state=inactive]:hidden"
          >
            <ScheduleManager />
          </Tabs.Content>
        </Tabs.Root>
      );
    default:
      return (
        <div className="flex flex-col items-center justify-center py-24 text-white/30">
          <p className="text-lg font-medium">Template not implemented yet</p>
          <p className="text-sm mt-1">
            "{template.name}" is a placeholder — build its component and add a
            case to TemplateWorkspace.
          </p>
        </div>
      );
  }
}

export default function App() {
  const [selected, setSelected] = useState<ReportTemplateEntry | null>(null);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass-panel border-b border-white/10 px-6 py-4 shrink-0">
        <h1 className="text-2xl font-bold text-white">MRI Software</h1>
        <p className="text-sm text-white/50">
          JIRA metrics &rarr; formatted emails
        </p>
      </header>

      <div className="flex flex-1 min-h-0">
        <TemplateSidebar
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
        />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">
            {selected ? (
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-white">
                    {selected.name}
                  </h2>
                  <p className="text-sm text-white/50">
                    {selected.description}
                  </p>
                </div>
                <TemplateWorkspace template={selected} />
              </>
            ) : (
              <TemplateHome />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
