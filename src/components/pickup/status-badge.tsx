import { cn } from "@/lib/cn";

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
}: {
  status: "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
  isExpired?: boolean;
}) {
  const { label, tone } = describe(status, isExpired);

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
): { label: string; tone: string } {
  if (status === "APPROVED" && isExpired) {
    return { label: "Expired", tone: "bg-ink/10 text-ink-soft" };
  }
  switch (status) {
    case "APPROVED":
      return { label: "Approved", tone: "bg-leaf-soft text-leaf-dark" };
    case "PENDING":
      return { label: "Awaiting approval", tone: "bg-sun-soft text-warning" };
    case "REJECTED":
      return { label: "Not approved", tone: "bg-coral-soft text-danger" };
    case "REVOKED":
      return { label: "Removed", tone: "bg-ink/10 text-ink-soft" };
  }
}
