"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Eye, Edit3 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogCloseButton,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MERGE_FIELDS,
  TEMPLATE_KINDS,
  templateKindLabel,
  type TemplateKind,
} from "@/lib/outreach";
import {
  cloneTemplate,
  createTemplate,
  deleteTemplate,
  updateTemplate,
} from "@/app/app/templates/actions";

export interface TemplateInput {
  id?: string;
  name: string;
  kind: TemplateKind;
  subject: string | null;
  body: string;
  appliesTo: string | null;
  /** True when this is a platform-default — read-only, can be cloned. */
  isReadOnly?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: TemplateInput | null;
}

export function TemplateDialog({ open, onOpenChange, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = React.useState<TemplateInput>({
    name: "",
    kind: "email",
    subject: "",
    body: "",
    appliesTo: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const bodyRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    if (open) {
      setForm({
        id: initial?.id,
        name: initial?.name ?? "",
        kind: (initial?.kind ?? "email") as TemplateKind,
        subject: initial?.subject ?? "",
        body: initial?.body ?? "",
        appliesTo: initial?.appliesTo ?? "",
        isReadOnly: initial?.isReadOnly,
      });
    }
  }, [open, initial]);

  const readOnly = !!form.isReadOnly;

  function insertToken(token: string) {
    if (readOnly) return;
    const placeholder = `{{${token}}}`;
    const el = bodyRef.current;
    if (!el) {
      setForm((f) => ({ ...f, body: f.body + placeholder }));
      return;
    }
    const start = el.selectionStart ?? form.body.length;
    const end = el.selectionEnd ?? form.body.length;
    const next = form.body.slice(0, start) + placeholder + form.body.slice(end);
    setForm((f) => ({ ...f, body: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + placeholder.length, start + placeholder.length);
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || readOnly) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        kind: form.kind,
        subject: form.kind === "email" ? (form.subject ?? null) : null,
        body: form.body,
        appliesTo: form.appliesTo ?? null,
      };
      const res = form.id
        ? await updateTemplate({ id: form.id, ...payload })
        : await createTemplate(payload);
      if (res.ok) {
        toast.success(form.id ? "Template saved" : "Template created");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error("error" in res ? res.error : "Could not save");
      }
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!form.id || readOnly) return;
    if (!confirm("Delete this template?")) return;
    setDeleting(true);
    try {
      const res = await deleteTemplate({ id: form.id });
      if (res.ok) {
        toast.success("Template deleted");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error("error" in res ? res.error : "Could not delete");
        setDeleting(false);
      }
    } catch {
      setDeleting(false);
    }
  }

  async function onClone() {
    if (!form.id) return;
    const res = await cloneTemplate({ id: form.id });
    if (res.ok) {
      toast.success("Cloned to your library — edit away");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error("error" in res ? res.error : "Could not clone");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 grid place-items-center rounded-full bg-brand text-brand-fg">
              {readOnly ? <Eye className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
            </div>
            <div>
              <DialogTitle>
                {readOnly
                  ? "Platform template (read-only)"
                  : form.id
                    ? "Edit template"
                    : "New template"}
              </DialogTitle>
              <DialogDescription>
                {readOnly
                  ? "Clone this template to your library to edit the copy."
                  : "Use {{tokens}} for merge fields like {{businessName}}."}
              </DialogDescription>
            </div>
          </div>
          <DialogCloseButton />
        </DialogHeader>

        <form onSubmit={onSubmit} className="px-6 pb-6 grid gap-5">
          <div className="grid sm:grid-cols-[1fr_auto] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="t-name">Name</Label>
              <Input
                id="t-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Cold email — restaurant"
                required
                disabled={readOnly}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Kind</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm((f) => ({ ...f, kind: v as TemplateKind }))}
                disabled={readOnly}
              >
                <SelectTrigger className="min-w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {templateKindLabel(k)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.kind === "email" && (
            <div className="grid gap-1.5">
              <Label htmlFor="t-subject">Subject</Label>
              <Input
                id="t-subject"
                value={form.subject ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Quick idea for {{businessName}}"
                disabled={readOnly}
              />
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="t-applies">Applies to (optional)</Label>
            <Input
              id="t-applies"
              value={form.appliesTo ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, appliesTo: e.target.value }))}
              placeholder="restaurant, salon, HVAC… (blank = any)"
              disabled={readOnly}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="t-body">Body</Label>
            <Textarea
              ref={bodyRef}
              id="t-body"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              rows={12}
              className="font-mono text-xs leading-relaxed"
              required
              disabled={readOnly}
            />
          </div>

          {!readOnly && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-surface-500 mb-2">
                Insert merge field
              </div>
              <div className="flex flex-wrap gap-1.5">
                {MERGE_FIELDS.map((f) => (
                  <button
                    key={f.token}
                    type="button"
                    onClick={() => insertToken(f.token)}
                    className="inline-flex items-center rounded-full bg-surface-100 px-2.5 py-1 text-xs font-mono text-surface-700 hover:bg-brand hover:text-brand-fg transition"
                    title={f.label}
                  >
                    {`{{${f.token}}}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <div>
              {form.id && !readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onDelete}
                  disabled={deleting}
                  className="text-red-700 hover:bg-red-50"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {readOnly ? (
                <Button type="button" onClick={onClone}>
                  Clone to my library
                </Button>
              ) : (
                <Button type="submit" disabled={saving || !form.name.trim() || !form.body.trim()}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {form.id ? "Save changes" : "Create template"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
