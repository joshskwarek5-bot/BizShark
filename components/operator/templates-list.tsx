"use client";

import * as React from "react";
import { Plus, ShieldCheck, Mail, MessageSquare, Phone, Voicemail, FileText } from "lucide-react";
import { TemplateDialog, type TemplateInput } from "./template-dialog";
import { templateKindLabel } from "@/lib/outreach";

interface TemplateRow {
  id: string;
  operatorId: string | null;
  name: string;
  kind: string;
  subject: string | null;
  body: string;
  appliesTo: string | null;
}

interface Props {
  yourTemplates: TemplateRow[];
  platformTemplates: TemplateRow[];
}

export function TemplatesList({ yourTemplates, platformTemplates }: Props) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TemplateInput | null>(null);

  function openCreate() {
    setEditing({
      name: "",
      kind: "email",
      subject: "",
      body: "",
      appliesTo: "",
    });
    setDialogOpen(true);
  }

  function openEdit(t: TemplateRow, readOnly: boolean) {
    setEditing({
      id: t.id,
      name: t.name,
      kind: t.kind as TemplateInput["kind"],
      subject: t.subject,
      body: t.body,
      appliesTo: t.appliesTo,
      isReadOnly: readOnly,
    });
    setDialogOpen(true);
  }

  return (
    <>
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-medium text-brand-fg shadow-soft active:scale-[0.98] transition"
        >
          <Plus className="h-4 w-4" /> New template
        </button>
      </div>

      <section className="mb-8">
        <h2 className="font-display text-xl text-surface-900 mb-3">Your templates</h2>
        {yourTemplates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-surface-300 bg-white/60 p-8 text-center text-sm text-surface-500">
            You haven&apos;t saved any custom templates yet — clone a platform one below to
            get started, or click <strong>New template</strong>.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {yourTemplates.map((t) => (
              <TemplateCard key={t.id} template={t} onClick={() => openEdit(t, false)} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-display text-xl text-surface-900">Platform templates</h2>
          <span className="inline-flex items-center gap-1 text-xs text-surface-500">
            <ShieldCheck className="h-3.5 w-3.5" /> Read-only — clone to edit
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {platformTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              isPlatform
              onClick={() => openEdit(t, true)}
            />
          ))}
        </div>
      </section>

      <TemplateDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        initial={editing}
      />
    </>
  );
}

function TemplateCard({
  template,
  onClick,
  isPlatform,
}: {
  template: TemplateRow;
  onClick: () => void;
  isPlatform?: boolean;
}) {
  const Icon = kindIcon(template.kind);
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-2xl border border-surface-200 bg-white p-5 shadow-soft hover:shadow-elevated hover:border-brand/30 transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 grid place-items-center rounded-lg bg-brand/10 text-brand shrink-0">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-surface-900 truncate">{template.name}</div>
            <div className="text-xs text-surface-500 mt-0.5">
              {templateKindLabel(template.kind)}
              {template.appliesTo ? ` · ${template.appliesTo}` : ""}
            </div>
          </div>
        </div>
        {isPlatform && (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-surface-600 shrink-0">
            <ShieldCheck className="h-2.5 w-2.5" /> Platform
          </span>
        )}
      </div>
      {template.subject && (
        <div className="text-xs text-surface-700 mb-2 truncate">
          <span className="text-surface-500">Subj:</span> {template.subject}
        </div>
      )}
      <div className="text-xs text-surface-600 line-clamp-4 leading-relaxed whitespace-pre-line">
        {template.body}
      </div>
    </button>
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
