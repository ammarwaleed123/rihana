import { describe, expect, it } from "vitest";

import { isActivePickup, isExpired } from "@/lib/data/pickup-rules";
import {
  pickupMethodInput,
  pickupPersonInput,
  requiredPhone,
} from "@/lib/validation";

/**
 * The door board's "who may collect right now" rule and the input validation
 * behind adding a pickup person. All pure — no database.
 */

// Local-midnight constructor so setHours(0,0,0,0) inside isExpired lines up
// with the test dates regardless of the machine's timezone.
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const NOW = new Date(2026, 6, 24, 10, 30); // 24 Jul 2026, mid-morning

describe("isExpired", () => {
  it("never expires without an end date", () => {
    expect(isExpired(null, NOW)).toBe(false);
  });

  it("is not expired on the last allowed day", () => {
    // "Allowed until 24 Jul" means they can still collect on the 24th.
    expect(isExpired(day(2026, 7, 24), NOW)).toBe(false);
  });

  it("is expired the day after the end date", () => {
    expect(isExpired(day(2026, 7, 23), NOW)).toBe(true);
  });

  it("is not expired for a future end date", () => {
    expect(isExpired(day(2026, 7, 25), NOW)).toBe(false);
  });
});

describe("isActivePickup", () => {
  it("an approved person with no end date may collect", () => {
    expect(isActivePickup({ status: "APPROVED", expiresAt: null }, NOW)).toBe(true);
  });

  it("an approved but lapsed person may not", () => {
    expect(
      isActivePickup({ status: "APPROVED", expiresAt: day(2026, 7, 1) }, NOW),
    ).toBe(false);
  });

  it("an approved person whose window ends today still may", () => {
    expect(
      isActivePickup({ status: "APPROVED", expiresAt: day(2026, 7, 24) }, NOW),
    ).toBe(true);
  });

  it("a pending person may not — approval is the gate", () => {
    expect(isActivePickup({ status: "PENDING", expiresAt: null }, NOW)).toBe(false);
  });

  it("a rejected person may not", () => {
    expect(isActivePickup({ status: "REJECTED", expiresAt: null }, NOW)).toBe(false);
  });
});

describe("requiredPhone", () => {
  it("rejects an empty value — a pickup person must be reachable", () => {
    expect(requiredPhone.safeParse("").success).toBe(false);
  });

  it("accepts and keeps a local Egyptian mobile", () => {
    const result = requiredPhone.safeParse("01012345678");
    expect(result.success && result.data).toBe("01012345678");
  });

  it("folds an international +20 number to the local form", () => {
    const result = requiredPhone.safeParse("+20 100 123 4567");
    expect(result.success && result.data).toBe("01001234567");
  });

  it("rejects a string of zeros", () => {
    expect(requiredPhone.safeParse("00000000000").success).toBe(false);
  });
});

describe("pickupPersonInput", () => {
  const base = {
    fullName: "Fatima Saeed",
    relationship: "Grandmother",
    phone: "01012345678",
    expiresAt: "",
  };

  it("accepts a complete person and leaves an empty end date null", () => {
    const result = pickupPersonInput.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe("01012345678");
      expect(result.data.expiresAt).toBeNull();
    }
  });

  it("parses a future end date into a Date", () => {
    const result = pickupPersonInput.safeParse({ ...base, expiresAt: "2030-01-01" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.expiresAt).toBeInstanceOf(Date);
  });

  it("rejects an end date in the past", () => {
    const result = pickupPersonInput.safeParse({ ...base, expiresAt: "2020-01-01" });
    expect(result.success).toBe(false);
  });

  it("requires a name, a relationship and a phone", () => {
    expect(pickupPersonInput.safeParse({ ...base, fullName: "" }).success).toBe(false);
    expect(
      pickupPersonInput.safeParse({ ...base, relationship: "" }).success,
    ).toBe(false);
    expect(pickupPersonInput.safeParse({ ...base, phone: "" }).success).toBe(false);
  });
});

describe("pickupMethodInput", () => {
  const childId = "abcdefghijklmnopqrstuvwx"; // 24 chars, within cuid bounds

  it("accepts the two real arrangements", () => {
    expect(pickupMethodInput.safeParse({ childId, method: "HANDOVER" }).success).toBe(
      true,
    );
    expect(pickupMethodInput.safeParse({ childId, method: "BUS" }).success).toBe(true);
  });

  it("rejects anything else", () => {
    expect(pickupMethodInput.safeParse({ childId, method: "TRAIN" }).success).toBe(
      false,
    );
  });
});
