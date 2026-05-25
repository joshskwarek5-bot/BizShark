"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signupOperator, type SignupState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full mt-2" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Creating your account…
        </>
      ) : (
        "Start free 14-day trial"
      )}
    </Button>
  );
}

export function SignupForm() {
  const [state, formAction] = useFormState<SignupState, FormData>(signupOperator, {
    ok: false,
  });
  return (
    <form action={formAction} className="grid gap-5">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Your name *</Label>
        <Input
          id="name"
          name="name"
          required
          autoComplete="name"
          placeholder="Alex Morgan"
        />
        {state.fieldErrors?.name && (
          <p className="text-xs text-red-600">{state.fieldErrors.name[0]}</p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
        {state.fieldErrors?.email && (
          <p className="text-xs text-red-600">{state.fieldErrors.email[0]}</p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="password">Password *</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="At least 8 characters"
          minLength={8}
        />
        {state.fieldErrors?.password && (
          <p className="text-xs text-red-600">{state.fieldErrors.password[0]}</p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="businessName">Agency name (optional)</Label>
        <Input
          id="businessName"
          name="businessName"
          autoComplete="organization"
          placeholder="Acme Web Studio"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div className="grid gap-1.5">
          <Label htmlFor="areaCity">Your city (optional)</Label>
          <Input
            id="areaCity"
            name="areaCity"
            placeholder="Denver"
            autoComplete="address-level2"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="areaState">State (optional)</Label>
          <Input
            id="areaState"
            name="areaState"
            placeholder="CO"
            autoComplete="address-level1"
            maxLength={2}
          />
        </div>
      </div>

      {state.error && (
        <div className="rounded-xl bg-red-50 ring-1 ring-red-200 p-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <SubmitButton />
      <p className="text-xs text-surface-500 text-center">
        No credit card required. 14-day free trial of all features.
      </p>
    </form>
  );
}
