"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSetupLink, revokeSetupLink } from "@/app/app/clients/[slug]/handoff/actions";

export interface LiveSetupLink {
  id: string;
  token: string;
  email: string;
  name: string | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

export interface HandoffCardProps {
  slug: string;
  restaurantName: string;
  defaultEmail: string;
  currentAdminCount: number;
  liveLink: LiveSetupLink | null;
}

export function HandoffCard({
  slug,
  restaurantName,
  defaultEmail,
  currentAdminCount,
  liveLink,
}: HandoffCardProps) {
  const [email, setEmail] = React.useState(defaultEmail);
  const [name, setName] = React.useState("");
  const [pending, startTransition] = useTransition();
  const [revoking, startRevoke] = useTransition();
  const [newLink, setNewLink] = React.useState<{ url: string; expiresAt: string } | null>(
    null
  );

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }
    startTransition(async () => {
      const res = await createSetupLink({
        slug,
        email: email.trim(),
        name: name.trim() || undefined,
      });
      if (!res.ok || !res.url) {
        toast.error(res.error ?? "Couldn't create link");
        return;
      }
      const full = `${window.location.origin}${res.url}`;
      setNewLink({ url: full, expiresAt: res.expiresAt ?? "" });
      toast.success("Setup link generated");
    });
  }

  function onRevoke(linkId: string) {
    if (!confirm("Revoke this setup link? The client won't be able to use it.")) return;
    startRevoke(async () => {
      const res = await revokeSetupLink({ linkId });
      if (!res.ok) toast.error(res.error ?? "Couldn't revoke");
      else {
        toast.success("Link revoked");
        setNewLink(null);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Generator */}
      <div className="lg:col-span-3 rounded-3xl border border-surface-200 bg-white p-6 shadow-soft">
        <div className="flex items-start gap-3 mb-5">
          <div className="h-9 w-9 grid place-items-center rounded-xl bg-brand/10 text-brand">
            <Send className="h-4 w-4" />
          </div>
          <div>
            <div className="font-display text-xl text-surface-900">
              Hand off to the client
            </div>
            <p className="text-sm text-surface-500 mt-0.5">
              Generate a one-time link they use to set a password and become the
              admin of <span className="font-medium text-surface-800">{restaurantName}</span>.
            </p>
          </div>
        </div>

        <form onSubmit={onCreate} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="ho-email">Client email *</Label>
            <Input
              id="ho-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@theirbusiness.com"
            />
            <p className="text-[11px] text-surface-500">
              They&apos;ll sign in with this email after picking a password.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ho-name">Their name (optional)</Label>
            <Input
              id="ho-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
            />
          </div>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating…
              </>
            ) : liveLink ? (
              <>
                <RefreshCw className="h-4 w-4" /> Regenerate link
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Generate setup link
              </>
            )}
          </Button>
          {liveLink && (
            <p className="text-[11px] text-amber-700 -mt-1 flex items-start gap-1.5">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              An active link already exists. Generating again will revoke the old
              one.
            </p>
          )}
        </form>

        {newLink && (
          <FreshLinkCard
            url={newLink.url}
            expiresAt={newLink.expiresAt}
            email={email}
            restaurantName={restaurantName}
          />
        )}
      </div>

      {/* Status / live link */}
      <div className="lg:col-span-2 grid gap-4 content-start">
        <div className="rounded-3xl bg-surface-50 ring-1 ring-surface-200 p-5">
          <div className="text-xs uppercase tracking-wider font-medium text-surface-500 mb-2">
            Current admins
          </div>
          <div className="font-mono text-3xl tabular-nums text-surface-900">
            {currentAdminCount}
          </div>
          <p className="text-xs text-surface-500 mt-1">
            {currentAdminCount === 0
              ? "Nobody has admin access yet — generate a link below."
              : currentAdminCount === 1
                ? "1 person has admin access to this site."
                : `${currentAdminCount} people have admin access to this site.`}
          </p>
        </div>

        {liveLink && !newLink && (
          <div className="rounded-3xl bg-white ring-1 ring-surface-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="h-4 w-4 text-surface-500" />
              <div className="text-sm font-medium text-surface-900">
                Outstanding link
              </div>
            </div>
            <div className="text-xs text-surface-500">To</div>
            <div className="text-sm text-surface-900 mb-2">{liveLink.email}</div>
            <div className="text-xs text-surface-500">Expires</div>
            <div className="text-sm text-surface-900 mb-3">
              {new Date(liveLink.expiresAt).toLocaleString()}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => onRevoke(liveLink.id)}
              disabled={revoking}
            >
              <Trash2 className="h-3.5 w-3.5" /> Revoke link
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function FreshLinkCard({
  url,
  expiresAt,
  email,
  restaurantName,
}: {
  url: string;
  expiresAt: string;
  email: string;
  restaurantName: string;
}) {
  const [copied, setCopied] = React.useState<"url" | "email" | null>(null);
  function copy(text: string, which: "url" | "email") {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      toast.success("Copied");
      setTimeout(() => setCopied(null), 1500);
    });
  }
  const emailBody = `Hi,\n\nYour ${restaurantName} website is ready. Use this link to set your admin password — it'll only work once:\n\n${url}\n\nIt expires ${new Date(expiresAt).toLocaleString()}.\n\nTalk soon.`;

  return (
    <div className="mt-6 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Check className="h-4 w-4 text-emerald-700" />
        <div className="text-sm font-medium text-emerald-900">
          Setup link ready — share with {email}
        </div>
      </div>
      <div className="grid gap-3">
        <div>
          <Label className="text-xs">One-time link</Label>
          <div className="mt-1 flex gap-2">
            <Input value={url} readOnly className="font-mono text-xs" />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => copy(url, "url")}
            >
              {copied === "url" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
        <div>
          <Label className="text-xs">Suggested email</Label>
          <textarea
            readOnly
            value={emailBody}
            rows={6}
            className="mt-1 w-full rounded-xl border border-surface-200 bg-white p-3 text-xs font-mono leading-relaxed text-surface-800"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => copy(emailBody, "email")}
          >
            {copied === "email" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            Copy email
          </Button>
        </div>
      </div>
    </div>
  );
}
