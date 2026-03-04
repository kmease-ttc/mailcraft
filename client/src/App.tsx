import { ReportView } from "./components/ReportView";

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Mailcraft</h1>
        <p className="text-sm text-gray-500">
          JIRA metrics → formatted emails
        </p>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <ReportView />
      </main>
    </div>
  );
}
