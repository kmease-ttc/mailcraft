/** Registry of all available report templates */

export interface ReportTemplateEntry {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  category: "engineering" | "operations" | "custom";
  /** Which component to render — maps to a switch in the UI */
  componentKey: string;
}

export const REPORT_TEMPLATES: ReportTemplateEntry[] = [
  {
    id: "sdlc-metrics",
    name: "SDLC Metrics",
    description: "JIRA-based delivery, quality, flow & backlog health metrics",
    icon: "BarChart3",
    category: "engineering",
    componentKey: "sdlc-metrics",
  },
  // Add more templates here:
  // {
  //   id: "sprint-summary",
  //   name: "Sprint Summary",
  //   description: "End-of-sprint highlights and velocity trends",
  //   icon: "Zap",
  //   category: "engineering",
  //   componentKey: "sprint-summary",
  // },
];

export const TEMPLATE_CATEGORIES = [
  { id: "engineering", label: "Engineering" },
  { id: "operations", label: "Operations" },
  { id: "custom", label: "Custom" },
] as const;
