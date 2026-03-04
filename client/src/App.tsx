import { useState } from "react";
import type { EmailDef } from "@shared/emailTemplates";
import { EmailList } from "./components/EmailList";
import { EmailEditor } from "./components/EmailEditor";

export default function App() {
  const [selected, setSelected] = useState<EmailDef | null>(null);

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Mailcraft</h1>
        <p className="text-sm text-gray-500">
          JIRA metrics → formatted emails
        </p>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {selected ? (
          <EmailEditor
            key={selected.id}
            email={selected}
            onBack={() => setSelected(null)}
          />
        ) : (
          <EmailList onSelect={setSelected} />
        )}
      </main>
    </div>
  );
}
