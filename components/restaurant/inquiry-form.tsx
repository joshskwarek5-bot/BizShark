"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Send, CheckCircle2, MessageSquareQuote, CalendarClock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitInquiry } from "@/app/r/[slug]/(customer)/inquiry-actions";

type Kind = "quote" | "contact" | "appointment";

interface Props {
  slug: string;
  kind: Kind;
  /** Service names from the restaurant's services list — populates the picker. */
  serviceNames?: string[];
}

const COPY: Record<
  Kind,
  {
    title: string;
    blurb: string;
    submitLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    sectionId: string;
  }
> = {
  quote: {
    title: "Get a free quote",
    blurb: "Tell us about your job. We'll get back to you within one business day.",
    submitLabel: "Request quote",
    icon: MessageSquareQuote,
    sectionId: "quote",
  },
  appointment: {
    title: "Request an appointment",
    blurb: "Pick what you're after and when — we'll confirm by phone or email.",
    submitLabel: "Request appointment",
    icon: CalendarClock,
    sectionId: "appointment",
  },
  contact: {
    title: "Send us a message",
    blurb: "Got a question? Drop a note and we'll get back to you.",
    submitLabel: "Send message",
    icon: Mail,
    sectionId: "contact",
  },
};

export function InquiryForm({ slug, kind, serviceNames = [] }: Props) {
  const meta = COPY[kind];
  const Icon = meta.icon;
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    phone: "",
    message: "",
    serviceRequested: "",
    preferredDate: "",
    preferredTime: "",
    address: "",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!form.name.trim()) {
      toast.error("What's your name?");
      return;
    }
    if (!form.email.trim() && !form.phone.trim()) {
      toast.error("Add an email or phone so we can reach you");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitInquiry({
        slug,
        kind,
        ...form,
      });
      if (res.ok) {
        setSent(true);
        toast.success("Sent — we'll be in touch");
      } else {
        toast.error("error" in res ? res.error : "Could not send");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <section
        id={meta.sectionId}
        className="bg-white py-16 px-4 sm:px-6 lg:px-10 border-t border-surface-100"
      >
        <div className="max-w-2xl mx-auto text-center">
          <div className="mx-auto h-14 w-14 grid place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h2 className="mt-4 font-display text-3xl text-surface-900">Thanks!</h2>
          <p className="mt-2 text-surface-600">
            Your {kind === "appointment" ? "appointment request" : kind === "quote" ? "quote request" : "message"} is in. We'll be in touch shortly.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      id={meta.sectionId}
      className="bg-white py-16 px-4 sm:px-6 lg:px-10 border-t border-surface-100"
    >
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand text-brand-fg">
            <Icon className="h-5 w-5" />
          </div>
          <h2 className="mt-4 font-display text-4xl text-surface-900">{meta.title}</h2>
          <p className="mt-2 text-surface-600">{meta.blurb}</p>
        </div>

        <form onSubmit={onSubmit} className="grid gap-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="iq-name">Your name *</Label>
              <Input
                id="iq-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoComplete="name"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="iq-phone">Phone</Label>
              <Input
                id="iq-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                autoComplete="tel"
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="iq-email">Email</Label>
            <Input
              id="iq-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
              placeholder="you@email.com"
            />
            <p className="text-[11px] text-surface-500">
              Add an email or phone so we can reach you.
            </p>
          </div>

          {kind === "appointment" && (
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="grid gap-1.5">
                <Label htmlFor="iq-service">Service</Label>
                {serviceNames.length > 0 ? (
                  <select
                    id="iq-service"
                    value={form.serviceRequested}
                    onChange={(e) =>
                      setForm({ ...form, serviceRequested: e.target.value })
                    }
                    className="h-11 rounded-xl border border-surface-200 bg-white px-4 text-sm text-surface-900 shadow-crisp focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                  >
                    <option value="">Pick one…</option>
                    {serviceNames.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="iq-service"
                    value={form.serviceRequested}
                    onChange={(e) =>
                      setForm({ ...form, serviceRequested: e.target.value })
                    }
                    placeholder="What are you after?"
                  />
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="iq-date">Preferred date</Label>
                <Input
                  id="iq-date"
                  type="date"
                  value={form.preferredDate}
                  onChange={(e) =>
                    setForm({ ...form, preferredDate: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          {kind === "appointment" && (
            <div className="grid gap-1.5">
              <Label htmlFor="iq-time">Preferred time of day</Label>
              <select
                id="iq-time"
                value={form.preferredTime}
                onChange={(e) => setForm({ ...form, preferredTime: e.target.value })}
                className="h-11 rounded-xl border border-surface-200 bg-white px-4 text-sm text-surface-900 shadow-crisp focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="">Anytime</option>
                <option value="Morning">Morning (9 AM – 12 PM)</option>
                <option value="Afternoon">Afternoon (12 PM – 5 PM)</option>
                <option value="Evening">Evening (5 PM – 8 PM)</option>
              </select>
            </div>
          )}

          {kind === "quote" && (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="iq-svc">What kind of work? (optional)</Label>
                {serviceNames.length > 0 ? (
                  <select
                    id="iq-svc"
                    value={form.serviceRequested}
                    onChange={(e) =>
                      setForm({ ...form, serviceRequested: e.target.value })
                    }
                    className="h-11 rounded-xl border border-surface-200 bg-white px-4 text-sm text-surface-900 shadow-crisp focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                  >
                    <option value="">Not sure / other</option>
                    {serviceNames.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="iq-svc"
                    value={form.serviceRequested}
                    onChange={(e) =>
                      setForm({ ...form, serviceRequested: e.target.value })
                    }
                    placeholder="What service do you need?"
                  />
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="iq-address">Address (optional)</Label>
                <Input
                  id="iq-address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Where the work is"
                />
              </div>
            </>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="iq-msg">
              {kind === "quote" ? "Describe the job" : "Message"}
            </Label>
            <Textarea
              id="iq-msg"
              rows={4}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder={
                kind === "quote"
                  ? "Tell us what's going on — symptoms, urgency, any details you know."
                  : kind === "appointment"
                    ? "Anything we should know? (allergies, requests, etc.)"
                    : "What's on your mind?"
              }
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> {meta.submitLabel}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
