"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeSetup, type CompleteSetupState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full mt-2" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Setting things up…
        </>
      ) : (
        "Set my password & continue"
      )}
    </Button>
  );
}

export function SetupForm({
  token,
  email,
  defaultName,
}: {
  token: string;
  email: string;
  defaultName: string | null;
}) {
  const [state, formAction] = useFormState<CompleteSetupState, FormData>(completeSetup, {
    ok: false,
  });
  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="token" value={token} />
      <div className="grid gap-1.5">
        <Label>Your email</Label>
        <Input value={email} disabled className="opacity-70 cursor-not-allowed" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="name">Your name</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          defaultValue={defaultName ?? ""}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Choose a password *</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="At least 8 characters"
          minLength={8}
        />
      </div>
      {state.error && (
        <div className="rounded-xl bg-red-50 ring-1 ring-red-200 p-3 text-sm text-red-700">
          {state.error}
        </div>
      )}
      <SubmitButton />
    </form>
  );
}
