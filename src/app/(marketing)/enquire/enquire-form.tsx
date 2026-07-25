"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2 } from "lucide-react";

import { CtaLink } from "@/components/marketing/brand";
import { Alert, Field, Input } from "@/components/ui/form";
import {
  submitInquiryAction,
  type InquiryState,
} from "@/lib/marketing/inquiry-actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group inline-flex items-center justify-center gap-2 rounded-full bg-leaf px-7 py-3.5 font-display text-lg font-bold text-white shadow-pin transition-all hover:-translate-y-0.5 hover:bg-leaf-dark disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Sending…" : "Send enquiry"}
    </button>
  );
}

export function EnquireForm() {
  const [state, action] = useActionState<InquiryState, FormData>(
    submitInquiryAction,
    {},
  );

  if (state.success) {
    return (
      <div className="rounded-[1.75rem] border border-leaf/30 bg-leaf-soft/50 p-8 text-center shadow-pin">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-leaf text-white">
          <CheckCircle2 className="size-8" />
        </span>
        <h2 className="mt-4 font-display text-2xl font-bold">Message sent</h2>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">{state.success}</p>
        <div className="mt-6">
          <CtaLink href="/" variant="outline">
            Back to home
          </CtaLink>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" autoComplete="off">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      {/* Honeypot: hidden from people, tempting to bots. Never shown, never
          tabbable, never autofilled. */}
      <div aria-hidden className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden">
        <label htmlFor="company">Company (leave blank)</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="parentName" error={state.errors?.parentName}>
          <Input id="parentName" name="parentName" required autoComplete="name" />
        </Field>
        <Field label="Email" htmlFor="email" error={state.errors?.email}>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </Field>
      </div>

      <Field
        label="Phone"
        htmlFor="phone"
        hint="Egyptian mobile, e.g. 01012345678. The quickest way for us to reach you."
        error={state.errors?.phone}
      >
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          required
          autoComplete="tel"
          placeholder="01012345678"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Child's first name (optional)"
          htmlFor="childFirstName"
          error={state.errors?.childFirstName}
        >
          <Input id="childFirstName" name="childFirstName" autoComplete="off" />
        </Field>
        <Field
          label="Child's date of birth (optional)"
          htmlFor="childDateOfBirth"
          error={state.errors?.childDateOfBirth}
        >
          <Input id="childDateOfBirth" name="childDateOfBirth" type="date" />
        </Field>
      </div>

      <Field
        label="Preferred start date (optional)"
        htmlFor="preferredStartDate"
        hint="Roughly when you'd like your child to start."
        error={state.errors?.preferredStartDate}
      >
        <Input id="preferredStartDate" name="preferredStartDate" type="date" />
      </Field>

      <Field
        label="Anything you'd like us to know? (optional)"
        htmlFor="message"
        error={state.errors?.message}
      >
        <textarea
          id="message"
          name="message"
          rows={4}
          className="w-full rounded-xl border-2 border-ink/15 bg-card px-4 py-3 text-base text-ink placeholder:text-ink-faint transition-colors focus:border-leaf focus:outline-none"
          placeholder="Your questions, your child's needs, the best time to call…"
        />
      </Field>

      <Submit />
      <p className="text-sm text-ink-faint">
        We only use your details to reply about a place at the nursery.
      </p>
    </form>
  );
}
