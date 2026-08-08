"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2 } from "lucide-react";

import { CtaLink } from "@/components/marketing/brand";
import { cn } from "@/lib/cn";
import { Alert, Field, Input } from "@/components/ui/form";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import {
  submitInquiryAction,
  type InquiryState,
} from "@/lib/marketing/inquiry-actions";

type Kind = "VISIT" | "QUESTION";
type T = Dictionary["enquire"];

function Submit({ idleLabel, pendingLabel }: { idleLabel: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group inline-flex items-center justify-center gap-2 rounded-full bg-leaf px-7 py-3.5 font-display text-lg font-bold text-white shadow-pin transition-all hover:-translate-y-0.5 hover:bg-leaf-dark disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border-2 px-4 py-2 text-sm font-bold transition-colors",
        active
          ? "border-leaf bg-leaf text-white"
          : "border-ink/15 bg-card text-ink-soft hover:border-leaf hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function EnquireForm({
  locale,
  t,
  defaultKind = "QUESTION",
}: {
  locale: Locale;
  t: T;
  defaultKind?: Kind;
}) {
  const [state, action] = useActionState<InquiryState, FormData>(
    submitInquiryAction,
    {},
  );
  const [kind, setKind] = useState<Kind>(defaultKind);
  const isVisit = kind === "VISIT";

  if (state.success) {
    return (
      <div className="rounded-[1.75rem] border border-leaf/30 bg-leaf-soft/50 p-8 text-center shadow-pin">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-leaf text-white">
          <CheckCircle2 className="size-8" />
        </span>
        <h2 className="mt-4 font-display text-2xl font-bold">{t.successTitle}</h2>
        <p className="mx-auto mt-2 max-w-md text-ink-soft">{state.success}</p>
        <div className="mt-6">
          <CtaLink href={localePath(locale, "/")} variant="outline">
            {t.backHome}
          </CtaLink>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" autoComplete="off">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      {/* Honeypot: hidden from people, tempting to bots. Never shown, never
          tabbable, never autofilled. Positioned with a logical offset so it
          stays off-screen in both writing directions. */}
      <div aria-hidden className="absolute -start-[9999px] top-0 h-0 w-0 overflow-hidden">
        <label htmlFor="company">{t.honeypotLabel}</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {/* What the parent came for — steers the form and how staff triage it. */}
      <fieldset>
        <legend className="mb-2 block text-sm font-bold text-ink">
          {t.kindLegend}
        </legend>
        <div className="flex flex-wrap gap-2.5">
          <Choice active={isVisit} onClick={() => setKind("VISIT")}>
            {t.kindVisit}
          </Choice>
          <Choice active={!isVisit} onClick={() => setKind("QUESTION")}>
            {t.kindQuestion}
          </Choice>
        </div>
      </fieldset>
      <input type="hidden" name="kind" value={kind} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t.parentName} htmlFor="parentName" error={state.errors?.parentName}>
          <Input id="parentName" name="parentName" required autoComplete="name" />
        </Field>
        <Field label={t.email} htmlFor="email" error={state.errors?.email}>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </Field>
      </div>

      <Field label={t.phone} htmlFor="phone" hint={t.phoneHint} error={state.errors?.phone}>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          required
          autoComplete="tel"
          placeholder="01012345678"
          // A phone number is read left-to-right whatever the page direction.
          dir="ltr"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={t.childFirstName}
          htmlFor="childFirstName"
          error={state.errors?.childFirstName}
        >
          <Input id="childFirstName" name="childFirstName" autoComplete="off" />
        </Field>
        <Field
          label={t.childDateOfBirth}
          htmlFor="childDateOfBirth"
          error={state.errors?.childDateOfBirth}
        >
          <Input id="childDateOfBirth" name="childDateOfBirth" type="date" />
        </Field>
      </div>

      {isVisit ? (
        <Field
          label={t.preferredVisit}
          htmlFor="preferredVisit"
          hint={t.preferredVisitHint}
          error={state.errors?.preferredVisit}
        >
          <Input
            id="preferredVisit"
            name="preferredVisit"
            placeholder={t.preferredVisitPlaceholder}
          />
        </Field>
      ) : null}

      <Field
        label={t.preferredStartDate}
        htmlFor="preferredStartDate"
        hint={t.preferredStartHint}
        error={state.errors?.preferredStartDate}
      >
        <Input id="preferredStartDate" name="preferredStartDate" type="date" />
      </Field>

      <Field
        label={isVisit ? t.messageVisit : t.messageQuestion}
        htmlFor="message"
        error={state.errors?.message}
      >
        <textarea
          id="message"
          name="message"
          rows={4}
          required={!isVisit}
          // A parent may reply in either language regardless of the page's;
          // dir="auto" lets the browser pick per what they actually type.
          dir="auto"
          className="w-full rounded-xl border-2 border-ink/15 bg-card px-4 py-3 text-base text-ink placeholder:text-ink-faint transition-colors focus:border-leaf focus:outline-none"
          placeholder={
            isVisit ? t.messagePlaceholderVisit : t.messagePlaceholderQuestion
          }
        />
      </Field>

      <Submit
        idleLabel={isVisit ? t.submitVisit : t.submitQuestion}
        pendingLabel={t.submitting}
      />
      <p className="text-sm text-ink-faint">{t.privacyNote}</p>
    </form>
  );
}
