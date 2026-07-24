"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/form";
import { signOutAction } from "@/lib/auth/actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="ghost"
      disabled={pending}
      className="whitespace-nowrap"
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}

/**
 * Sign-out is a POST, never a link.
 *
 * A GET /signout could be triggered by any third-party page embedding it as an
 * image — annoying rather than dangerous, but a state change belongs behind a
 * form, where Next's origin check applies.
 */
export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <SubmitButton />
    </form>
  );
}
