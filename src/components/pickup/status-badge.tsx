import { cn } from "@/lib/cn";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

type StatusStrings = Dictionary["portal"]["pickupStatus"];

/**
 * The status of a pickup person, as a single glanceable pill.
 *
 * One component so the parent's list and the owner's queue can never disagree
 * about what "approved" looks like. Expiry is layered on top of status: an
 * approved person whose window has passed reads as "Expired", not "Approved",
 * because on the door board they can no longer collect.
 */
export function PickupStatusBadge({
  status,
  isExpired = false,
  t,
}: {
  status: "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
  isExpired?: boolean;
  t: StatusStrings;
}) {
  const { label, tone } = describe(status, isExpired, t);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold",
        tone,
      )}
    >
      {label}
    </span>
  );
}

function describe(
  status: "PENDING" | "APPROVED" | "REJECTED" | "REVOKED",
  isExpired: boolean,
  t: StatusStrings,
): { label: string; tone: string } {
  if (status === "APPROVED" && isExpired) {
    return { label: t.expired, tone: "bg-ink/10 text-ink-soft" };
  }
  switch (status) {
    case "APPROVED":
      return { label: t.approved, tone: "bg-leaf-soft text-leaf-dark" };
    case "PENDING":
      return { label: t.pending, tone: "bg-sun-soft text-warning" };
    case "REJECTED":
      return { label: t.rejected, tone: "bg-coral-soft text-danger" };
    case "REVOKED":
      return { label: t.revoked, tone: "bg-ink/10 text-ink-soft" };
  }
}
