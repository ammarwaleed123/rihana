import type { Locale } from "./config";
import type { Dictionary } from "./dictionaries/en";
import { fill, plural } from "./plural";

/**
 * Notification wording.
 *
 * A notification is written once and read much later, so its text cannot be a
 * finished English sentence baked into the row — that is data, and data does not
 * translate. Instead the fan-out stores a message KEY plus the ingredients in
 * `Notification.payload`, and the sentence is assembled here, in whichever
 * language the reader has chosen at the moment they look.
 *
 * Rows written before this existed carry no key. They fall back to the English
 * `title`/`body` still stored on every row, which is why no backfill was needed
 * and why the audit trail was left alone: old notifications simply stay in
 * English, and new ones are bilingual from the moment they are sent.
 *
 * Push is the one exception to "translate at reading time": the message leaves
 * for the device and is never re-rendered, so it has to be built at SEND time
 * from the recipient's saved language. A push already on someone's lock screen
 * therefore keeps the language it was sent in even if they switch afterwards —
 * inherent to push, not a defect.
 *
 * Names are never translated. A child's name, a class name, an album title and a
 * parent's stated reason are all data; only the sentence around them is ours.
 */

/** Every message this system can send. The `kind` is the stored key. */
export type NotificationMessage =
  | { kind: "photos.child"; count: number; childName: string }
  | { kind: "photos.class"; count: number; className: string }
  | { kind: "album.shared"; albumTitle: string }
  | { kind: "announcement.new"; announcementTitle: string }
  | {
      kind: "pickup.review";
      requestedBy: string;
      personName: string;
      childName: string;
    }
  | { kind: "pickup.approved"; personName: string; childName: string }
  | {
      kind: "pickup.rejected";
      personName: string;
      childName: string;
      reason?: string;
    }
  | { kind: "report.ready"; childName: string }
  | { kind: "report.updated"; childName: string }
  | { kind: "report.absent"; childName: string }
  | { kind: "accident.reported"; childName: string }
  | { kind: "accident.corrected"; childName: string }
  | { kind: "accident.acknowledged"; childName: string; parentName: string };

export type NotificationText = { title: string; body: string };

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Read a stored payload back into a message, or null if it is not one.
 *
 * Deliberately forgiving: `payload` is loose JSON that has held other shapes in
 * the past and will be read by pages that must not throw. Anything unrecognised
 * returns null and the caller falls back to the stored sentence.
 */
export function parseMessage(payload: unknown): NotificationMessage | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;

  switch (p.kind) {
    case "photos.child":
      return {
        kind: "photos.child",
        count: num(p.count),
        childName: str(p.childName),
      };
    case "photos.class":
      return {
        kind: "photos.class",
        count: num(p.count),
        className: str(p.className),
      };
    case "album.shared":
      return { kind: "album.shared", albumTitle: str(p.albumTitle) };
    case "announcement.new":
      return {
        kind: "announcement.new",
        announcementTitle: str(p.announcementTitle),
      };
    case "pickup.review":
      return {
        kind: "pickup.review",
        requestedBy: str(p.requestedBy),
        personName: str(p.personName),
        childName: str(p.childName),
      };
    case "pickup.approved":
      return {
        kind: "pickup.approved",
        personName: str(p.personName),
        childName: str(p.childName),
      };
    case "pickup.rejected":
      return {
        kind: "pickup.rejected",
        personName: str(p.personName),
        childName: str(p.childName),
        reason: str(p.reason) || undefined,
      };
    case "report.ready":
      return { kind: "report.ready", childName: str(p.childName) };
    case "report.updated":
      return { kind: "report.updated", childName: str(p.childName) };
    case "report.absent":
      return { kind: "report.absent", childName: str(p.childName) };
    case "accident.reported":
      return { kind: "accident.reported", childName: str(p.childName) };
    case "accident.corrected":
      return { kind: "accident.corrected", childName: str(p.childName) };
    case "accident.acknowledged":
      return {
        kind: "accident.acknowledged",
        childName: str(p.childName),
        parentName: str(p.parentName),
      };
    default:
      return null;
  }
}

/** Build the sentence for one message in one language. */
export function renderMessage(
  message: NotificationMessage,
  dict: Dictionary,
  locale: Locale,
): NotificationText {
  const t = dict.notify;

  switch (message.kind) {
    case "photos.child": {
      const name = message.childName || t.aChild;
      return {
        title: fill(plural(t.photosChildTitle, message.count, locale), { name }),
        body: fill(plural(t.photosChildBody, message.count, locale), { name }),
      };
    }
    case "photos.class": {
      const className = message.className || t.aClass;
      return {
        title: fill(plural(t.photosClassTitle, message.count, locale), {
          class: className,
        }),
        body: fill(plural(t.photosClassBody, message.count, locale), {
          class: className,
        }),
      };
    }
    case "album.shared":
      return {
        title: fill(t.albumTitle, { album: message.albumTitle }),
        body: fill(t.albumBody, { album: message.albumTitle }),
      };
    case "announcement.new":
      // The body is the announcement's own title — the nursery's words, shown
      // exactly as written.
      return { title: t.announcementTitle, body: message.announcementTitle };
    case "pickup.review":
      return {
        title: t.pickupReviewTitle,
        body: fill(t.pickupReviewBody, {
          requestedBy: message.requestedBy || t.aParent,
          person: message.personName,
          child: message.childName,
        }),
      };
    case "pickup.approved":
      return {
        title: t.pickupApprovedTitle,
        body: fill(t.pickupApprovedBody, {
          person: message.personName,
          child: message.childName,
        }),
      };
    case "pickup.rejected":
      return {
        title: t.pickupRejectedTitle,
        body: message.reason
          ? fill(t.pickupRejectedBodyReason, {
              person: message.personName,
              child: message.childName,
              reason: message.reason,
            })
          : fill(t.pickupRejectedBody, {
              person: message.personName,
              child: message.childName,
            }),
      };
    case "report.ready":
      return {
        title: fill(t.reportReadyTitle, { name: name(message, t) }),
        body: fill(t.reportReadyBody, { name: name(message, t) }),
      };
    case "report.updated":
      return {
        title: fill(t.reportUpdatedTitle, { name: name(message, t) }),
        body: fill(t.reportUpdatedBody, { name: name(message, t) }),
      };
    case "report.absent":
      return {
        title: fill(t.reportAbsentTitle, { name: name(message, t) }),
        body: fill(t.reportAbsentBody, { name: name(message, t) }),
      };
    /*
     * Says that something happened, never what. An accident's details are not
     * something to put on a lock screen beside the child's name, where whoever
     * is holding the phone can read them.
     */
    case "accident.reported":
      return {
        title: fill(t.accidentReportedTitle, { name: name(message, t) }),
        body: fill(t.accidentReportedBody, { name: name(message, t) }),
      };
    case "accident.corrected":
      return {
        title: t.accidentCorrectedTitle,
        body: fill(t.accidentCorrectedBody, { name: name(message, t) }),
      };
    case "accident.acknowledged":
      return {
        title: t.accidentAcknowledgedTitle,
        body: fill(t.accidentAcknowledgedBody, {
          parent: message.parentName || t.aParent,
          name: name(message, t),
        }),
      };
  }
}

/** A child's own name, or the stand-in when the fan-out could not resolve one. */
function name(
  message: { childName: string },
  t: Dictionary["notify"],
): string {
  return message.childName || t.aChild;
}

/**
 * The text to show for a stored notification row.
 *
 * The single place the old-row fallback lives: no key means a row written before
 * this mechanism existed, so its stored English sentence is used as-is.
 */
export function notificationText(
  row: { title: string; body: string; payload?: unknown },
  dict: Dictionary,
  locale: Locale,
): NotificationText {
  const message = parseMessage(row.payload);
  if (!message) return { title: row.title, body: row.body };
  return renderMessage(message, dict, locale);
}
