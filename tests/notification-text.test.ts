import { describe, expect, it } from "vitest";

import ar from "@/lib/i18n/dictionaries/ar";
import en from "@/lib/i18n/dictionaries/en";
import {
  notificationText,
  parseMessage,
  renderMessage,
  type NotificationMessage,
} from "@/lib/i18n/notification-text";

/**
 * Notification wording.
 *
 * The load-bearing behaviour here is the fallback. Notifications sent before
 * messages carried a key still hold a finished English sentence and nothing
 * else, and the decision was to leave those alone rather than rewrite history —
 * so a row with no key MUST render exactly what it stored, in any language. If
 * that ever breaks, every notification a family already received turns blank.
 */

describe("old rows are left exactly as they were", () => {
  const legacy = {
    title: "2 new photos of Laila",
    body: "2 new photos of Laila are ready to see.",
    payload: { childId: "abc", uploadSessionId: "xyz", count: 2 },
  };

  it("renders the stored English sentence when the payload has no key", () => {
    expect(notificationText(legacy, en, "en")).toEqual({
      title: legacy.title,
      body: legacy.body,
    });
  });

  it("does the same for an Arabic reader — there is nothing to translate", () => {
    expect(notificationText(legacy, ar, "ar")).toEqual({
      title: legacy.title,
      body: legacy.body,
    });
  });

  it.each([null, undefined, "", 42, [], { kind: "something.unknown" }])(
    "falls back rather than throwing on payload %p",
    (payload) => {
      expect(parseMessage(payload)).toBeNull();
      expect(notificationText({ ...legacy, payload }, ar, "ar")).toEqual({
        title: legacy.title,
        body: legacy.body,
      });
    },
  );
});

describe("new rows are built from their key", () => {
  const message: NotificationMessage = {
    kind: "photos.child",
    count: 2,
    childName: "Laila",
  };

  it("reads in English for an English reader", () => {
    expect(renderMessage(message, en, "en")).toEqual({
      title: "2 new photos of Laila",
      body: "2 new photos of Laila are ready to see.",
    });
  });

  it("reads in Arabic for an Arabic reader, from the same row", () => {
    const text = renderMessage(message, ar, "ar");
    expect(text.title).toContain("Laila"); // a name is data, never translated
    expect(text.title).toMatch(/[؀-ۿ]/); // and the sentence is Arabic
    expect(text.title).not.toMatch(/new photos/);
  });

  it("prefers the payload over the stored English sentence", () => {
    const row = {
      title: "STALE ENGLISH",
      body: "STALE ENGLISH",
      payload: message,
    };
    expect(notificationText(row, en, "en").title).toBe("2 new photos of Laila");
  });
});

describe("Arabic plural forms", () => {
  // Arabic has six categories and picks between them by rules no `n === 1`
  // check captures — 3 and 13 take *different* forms. This is the reason the
  // sentence could not stay a string built at send time.
  const forCount = (count: number) =>
    renderMessage({ kind: "photos.child", count, childName: "ليلى" }, ar, "ar")
      .title;

  it("uses a distinct wording for one, two, few and many", () => {
    const wordings = new Set([forCount(1), forCount(2), forCount(3), forCount(11)]);
    expect(wordings.size).toBe(4);
  });

  it("does not leave a {n} placeholder unfilled", () => {
    for (const n of [0, 1, 2, 3, 11, 100]) {
      expect(forCount(n)).not.toContain("{n}");
      expect(forCount(n)).not.toContain("{name}");
    }
  });

  it("formats the number in Arabic-Indic digits", () => {
    expect(forCount(11)).toMatch(/[٠-٩]/);
    expect(forCount(11)).not.toMatch(/11/);
  });
});

describe("every message kind survives a round trip", () => {
  const all: NotificationMessage[] = [
    { kind: "photos.child", count: 3, childName: "Laila" },
    { kind: "photos.class", count: 3, className: "Sunflowers" },
    { kind: "album.shared", albumTitle: "Trip to the farm" },
    { kind: "announcement.new", announcementTitle: "Closed Monday" },
    {
      kind: "pickup.review",
      requestedBy: "Amal Saeed",
      personName: "Hoda Kamal",
      childName: "Laila",
    },
    { kind: "pickup.approved", personName: "Hoda Kamal", childName: "Laila" },
    { kind: "pickup.rejected", personName: "Hoda Kamal", childName: "Laila" },
    {
      kind: "pickup.rejected",
      personName: "Hoda Kamal",
      childName: "Laila",
      reason: "Not on our approved list",
    },
    { kind: "report.ready", childName: "Laila" },
    { kind: "report.updated", childName: "Laila" },
    { kind: "report.absent", childName: "Laila" },
    { kind: "accident.reported", childName: "Laila" },
    { kind: "accident.corrected", childName: "Laila" },
    {
      kind: "accident.acknowledged",
      childName: "Laila",
      parentName: "Amal Saeed",
    },
  ];

  it.each(all)("parses back and renders in both languages: $kind", (message) => {
    expect(parseMessage(message)).toEqual(message);

    for (const [dict, locale] of [
      [en, "en"],
      [ar, "ar"],
    ] as const) {
      const text = renderMessage(message, dict, locale);
      expect(text.title.length).toBeGreaterThan(0);
      expect(text.body.length).toBeGreaterThan(0);
      // An unfilled placeholder is the failure mode worth catching: it reads as
      // a bug to the parent and there is no test that would otherwise see it.
      expect(text.title + text.body).not.toMatch(/\{\w+\}/);
    }
  });

  it("keeps names out of the translation", () => {
    const text = renderMessage(all[4], ar, "ar");
    expect(text.body).toContain("Hoda Kamal");
    expect(text.body).toContain("Laila");
    expect(text.body).toContain("Amal Saeed");
  });

  it("shows the parent's own words when a pickup is turned down for a reason", () => {
    const text = renderMessage(all[7], ar, "ar");
    expect(text.body).toContain("Not on our approved list");
  });
});

/*
 * An accident notification lands on a lock screen, where the reader is whoever
 * is holding the phone. It may say that something happened and that the family
 * should look; it must not say what was injured or what was done about it.
 *
 * This is enforced structurally rather than by review: the message carries only
 * a child's name, so there is no field for a detail to travel in. The test
 * guards the shape, so adding one later has to be a deliberate decision.
 */
describe("accident notifications carry no details", () => {
  const detail = [
    "knee",
    "bite",
    "bruise",
    "betadine",
    "bandage",
    "doctor",
    "ركبة",
    "عضّة",
    "ضمادة",
  ];

  it.each([
    { kind: "accident.reported", childName: "Laila" },
    { kind: "accident.corrected", childName: "Laila" },
  ] as const)("says something happened, not what: $kind", (message) => {
    for (const [dict, locale] of [
      [en, "en"],
      [ar, "ar"],
    ] as const) {
      const text = renderMessage(message, dict, locale);
      const whole = `${text.title} ${text.body}`.toLowerCase();
      for (const word of detail) {
        expect(whole).not.toContain(word);
      }
    }
  });

  it("names the child, because the family must know who it is about", () => {
    const text = renderMessage(
      { kind: "accident.reported", childName: "Laila" },
      ar,
      "ar",
    );
    expect(text.title).toContain("Laila");
  });
});

describe("report notifications degrade when a child has been removed", () => {
  it.each([
    "report.ready",
    "report.updated",
    "report.absent",
    "accident.reported",
  ] as const)("uses the reader's stand-in rather than a gap: %s", (kind) => {
    const text = renderMessage({ kind, childName: "" }, ar, "ar");
    expect(text.title).toContain(ar.notify.aChild);
    expect(text.title).not.toMatch(/\{\w+\}/);
  });
});

describe("a missing name degrades in the reader's language", () => {
  // The child or class was deleted between the fan-out and the read.
  it("uses an Arabic stand-in for an Arabic reader", () => {
    const text = renderMessage(
      { kind: "photos.child", count: 1, childName: "" },
      ar,
      "ar",
    );
    expect(text.title).toContain(ar.notify.aChild);
    expect(text.title).not.toContain("your child");
  });

  it("uses the English stand-in for an English reader", () => {
    const text = renderMessage(
      { kind: "photos.class", count: 1, className: "" },
      en,
      "en",
    );
    expect(text.title).toContain("your child’s class");
  });
});
