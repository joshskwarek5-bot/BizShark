"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";
import { TEMPLATE_KINDS } from "@/lib/outreach";

async function ensureOperator() {
  const res = await requireOperator();
  if (!res.authorized) throw new Error(res.reason);
  return res;
}

const TemplateInputSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(TEMPLATE_KINDS),
  subject: z.string().max(240).optional().nullable(),
  body: z.string().min(1).max(4000),
  appliesTo: z.string().max(80).optional().nullable(),
});

export async function createTemplate(input: z.infer<typeof TemplateInputSchema>) {
  const { operator } = await ensureOperator();
  const parsed = TemplateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const tpl = await db.outreachTemplate.create({
    data: {
      operatorId: operator.id,
      name: parsed.data.name.trim(),
      kind: parsed.data.kind,
      subject: parsed.data.subject?.trim() || null,
      body: parsed.data.body,
      appliesTo: parsed.data.appliesTo?.trim() || null,
    },
  });
  revalidatePath("/app/templates");
  return { ok: true as const, id: tpl.id };
}

const UpdateSchema = TemplateInputSchema.extend({ id: z.string() });
export async function updateTemplate(input: z.infer<typeof UpdateSchema>) {
  const { operator } = await ensureOperator();
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const existing = await db.outreachTemplate.findUnique({ where: { id: parsed.data.id } });
  if (!existing || existing.operatorId !== operator.id) {
    // Platform-defaults (operatorId=null) are read-only for operators
    return { ok: false as const, error: "You can only edit your own templates" };
  }
  await db.outreachTemplate.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name.trim(),
      kind: parsed.data.kind,
      subject: parsed.data.subject?.trim() || null,
      body: parsed.data.body,
      appliesTo: parsed.data.appliesTo?.trim() || null,
    },
  });
  revalidatePath("/app/templates");
  return { ok: true as const };
}

export async function deleteTemplate(input: { id: string }) {
  const { operator } = await ensureOperator();
  const { id } = z.object({ id: z.string() }).parse(input);
  const existing = await db.outreachTemplate.findUnique({ where: { id } });
  if (!existing || existing.operatorId !== operator.id) {
    return { ok: false as const, error: "Can't delete this template" };
  }
  await db.outreachTemplate.delete({ where: { id } });
  revalidatePath("/app/templates");
  return { ok: true as const };
}

/** Duplicate a (usually platform-default) template into the operator's own
 *  library so they can edit it. */
export async function cloneTemplate(input: { id: string }) {
  const { operator } = await ensureOperator();
  const { id } = z.object({ id: z.string() }).parse(input);
  const src = await db.outreachTemplate.findUnique({ where: { id } });
  if (!src) return { ok: false as const, error: "Template not found" };
  // Allow cloning of platform-defaults OR your own (handy for variants)
  if (src.operatorId && src.operatorId !== operator.id) {
    return { ok: false as const, error: "Can't clone someone else's template" };
  }
  const copy = await db.outreachTemplate.create({
    data: {
      operatorId: operator.id,
      name: `${src.name} (copy)`,
      kind: src.kind,
      subject: src.subject,
      body: src.body,
      appliesTo: src.appliesTo,
    },
  });
  revalidatePath("/app/templates");
  return { ok: true as const, id: copy.id };
}
