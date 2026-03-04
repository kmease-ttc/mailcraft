import * as Tabs from "@radix-ui/react-tabs";
import { ReportView } from "./components/ReportView";
import { ReportHistory } from "./components/ReportHistory";
import { ScheduleManager } from "./components/ScheduleManager";

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="glass-panel border-b border-white/10 px-6 py-4">
        <h1 className="text-2xl font-bold text-white">MRI Software</h1>
        <p className="text-sm text-white/50">
          JIRA metrics &rarr; formatted emails
        </p>
      </header>

      <main className="max-w-5xl mx-auto p-6">
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

          <Tabs.Content value="report">
            <ReportView />
          </Tabs.Content>
          <Tabs.Content value="history">
            <ReportHistory />
          </Tabs.Content>
          <Tabs.Content value="schedules">
            <ScheduleManager />
          </Tabs.Content>
        </Tabs.Root>
      </main>
    </div>
  );
}
