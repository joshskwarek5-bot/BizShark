"use client";

import * as React from "react";
import { toast } from "sonner";
import { Copy, CheckCheck, Mail, MessageSquare, Phone, Voicemail, FileText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { fillTemplate, templateKindLabel, type MergeVars } from "@/lib/outreach";

interface RenderedTemplate {
  id: string;
  name: string;
  kind: string;
  isPlatform: boolean;
  subjectRaw: string | null;
  bodyRaw: string;
  subjectRendered: string | null;
  bodyRendered: string;
}

interface PitchPanelProps {
  templates: RenderedTemplate[];
  // Pretty-printed list of which merge fields had no value (so the operator
  // knows what's still a placeholder)
  missingFields: string[];
}

export function PitchPanel({ templates, missingFields }: PitchPanelProps) {
  const [active, setActive] = React.useState(templates[0]?.id ?? null);
  const current = templates.find((t) => t.id === active) ?? templates[0];

  if (!templates.length) {
    return (
      <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8">
        <div className="flex items-center gap-2 text-sm font-medium text-surface-500 mb-3">
          <Sparkles className="h-4 w-4 text-brand" />
          <span className="uppercase tracking-wider text-xs">Pitch</span>
        </div>
        <p className="text-surface-600 text-sm">
          No templates yet. Visit <a href="/app/templates" className="text-brand underline">Templates</a>{" "}
          to create one or clone a platform default.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
          <Sparkles className="h-4 w-4 text-brand" />
          <span className="uppercase tracking-wider text-xs">Pitch</span>
        </div>
        {missingFields.length > 0 && (
          <div className="text-xs text-amber-700 inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Placeholders still in copy: {missingFields.map((f) => `{{${f}}}`).join(", ")}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {templates.map((t) => {
          const Icon = kindIcon(t.kind);
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition",
                isActive
                  ? "bg-surface-900 text-white border-transparent"
                  : "bg-surface-50 text-surface-700 border-surface-200 hover:bg-surface-100"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.name}
            </button>
          );
        })}
      </div>

      {current && <RenderedView template={current} />}
    </section>
  );
}

function RenderedView({ template }: { template: RenderedTemplate }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-surface-500">
          {templateKindLabel(template.kind)}
          {template.isPlatform ? " · Platform default" : ""}
        </div>
      </div>

      {template.subjectRendered !== null && (
        <Field
          label="Subject"
          value={template.subjectRendered}
          mono={false}
          oneLine
        />
      )}
      <Field
        label={template.kind === "email" ? "Body" : "Script"}
        value={template.bodyRendered}
      />
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
  oneLine = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  oneLine?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy — your browser blocked clipboard access");
    }
  }

  return (
    <div className="rounded-2xl border border-surface-200 bg-surface-50/60">
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-surface-200">
        <div className="text-xs font-medium uppercase tracking-wider text-surface-500">
          {label}
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand/80"
        >
          {copied ? (
            <>
              <CheckCheck className="h-3.5 w-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy
            </>
          )}
        </button>
      </div>
      <div
        className={cn(
          "px-4 py-3 text-sm text-surface-800",
          oneLine ? "truncate" : "whitespace-pre-line leading-relaxed",
          mono && "font-mono text-xs"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function kindIcon(kind: string) {
  switch (kind) {
    case "email":
      return Mail;
    case "sms":
      return MessageSquare;
    case "voicemail":
      return Voicemail;
    case "script":
      return Phone;
    default:
      return FileText;
  }
}

// Re-exported types so the lead detail page can build the right input shape
export type { MergeVars };
