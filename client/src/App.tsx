import { useState } from "react";
import type { CsvRow, EmailTemplate } from "@shared/types";
import { CsvUploader } from "./components/CsvUploader";
import { ColumnMapper } from "./components/ColumnMapper";
import { TemplateEditor } from "./components/TemplateEditor";
import { EmailPreview } from "./components/EmailPreview";
import { SendPanel } from "./components/SendPanel";

type Step = "upload" | "map" | "template" | "preview" | "send";

export default function App() {
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [emailColumn, setEmailColumn] = useState("");
  const [template, setTemplate] = useState<EmailTemplate>({
    subject: "",
    bodyHtml: "",
  });

  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload CSV" },
    { key: "map", label: "Map Columns" },
    { key: "template", label: "Template" },
    { key: "preview", label: "Preview" },
    { key: "send", label: "Send" },
  ];

  const currentIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Mailcraft</h1>
        <p className="text-sm text-gray-500">
          Transform your data into beautiful emails
        </p>
      </header>

      {/* Step indicator */}
      <nav className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="flex gap-2">
          {steps.map((s, i) => (
            <button
              key={s.key}
              onClick={() => i <= currentIndex && setStep(s.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                s.key === step
                  ? "bg-indigo-500 text-white"
                  : i < currentIndex
                    ? "bg-indigo-100 text-indigo-700 cursor-pointer"
                    : "bg-gray-100 text-gray-400 cursor-default"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-6">
        {step === "upload" && (
          <CsvUploader
            onParsed={(parsedRows, parsedColumns) => {
              setRows(parsedRows);
              setColumns(parsedColumns);
              setStep("map");
            }}
          />
        )}

        {step === "map" && (
          <ColumnMapper
            columns={columns}
            emailColumn={emailColumn}
            onSelect={(col) => {
              setEmailColumn(col);
              setStep("template");
            }}
          />
        )}

        {step === "template" && (
          <TemplateEditor
            columns={columns}
            template={template}
            onChange={setTemplate}
            onNext={() => setStep("preview")}
          />
        )}

        {step === "preview" && (
          <EmailPreview
            rows={rows}
            template={template}
            emailColumn={emailColumn}
            onNext={() => setStep("send")}
            onBack={() => setStep("template")}
          />
        )}

        {step === "send" && (
          <SendPanel
            rows={rows}
            template={template}
            emailColumn={emailColumn}
          />
        )}
      </main>
    </div>
  );
}
