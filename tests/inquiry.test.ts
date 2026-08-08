import { describe, expect, it } from "vitest";

import { inquiryInput } from "@/lib/validation";

/**
 * Validation for the public admissions inquiry. The honeypot and rate limit live
 * in the server action; this covers the pure input schema.
 */

const base = {
  kind: "QUESTION",
  parentName: "Amira Hassan",
  email: "amira@example.com",
  // Phone is required (the owner wanted a number staff can call a lead back on).
  phone: "01001234567",
  childFirstName: "",
  childDateOfBirth: "",
  preferredStartDate: "",
  preferredVisit: "",
  // A question needs a message; a visit request does not.
  message: "Do you have a place in the toddler group?",
};

describe("inquiryInput", () => {
  it("accepts a question with name, email, phone and a message", () => {
    const result = inquiryInput.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe("QUESTION");
      expect(result.data.parentName).toBe("Amira Hassan");
      expect(result.data.phone).toBe("01001234567");
      expect(result.data.childDateOfBirth).toBeNull();
      expect(result.data.message).toBe("Do you have a place in the toddler group?");
    }
  });

  it("defaults the reason to a question when kind is omitted", () => {
    const { kind, ...withoutKind } = base;
    void kind;
    const result = inquiryInput.safeParse(withoutKind);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.kind).toBe("QUESTION");
  });

  it("requires a message when the reason is a question", () => {
    expect(inquiryInput.safeParse({ ...base, message: "" }).success).toBe(false);
  });

  it("allows a visit request with no message", () => {
    const result = inquiryInput.safeParse({
      ...base,
      kind: "VISIT",
      message: "",
      preferredVisit: "Weekday mornings",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe("VISIT");
      expect(result.data.message).toBeUndefined();
      expect(result.data.preferredVisit).toBe("Weekday mornings");
    }
  });

  it("rejects a missing name", () => {
    expect(inquiryInput.safeParse({ ...base, parentName: "" }).success).toBe(false);
  });

  it("rejects a missing phone (it is required)", () => {
    expect(inquiryInput.safeParse({ ...base, phone: "" }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(inquiryInput.safeParse({ ...base, email: "not-an-email" }).success).toBe(
      false,
    );
  });

  it("accepts a valid Egyptian phone and normalises it", () => {
    const result = inquiryInput.safeParse({ ...base, phone: "+20 100 123 4567" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBe("01001234567");
  });

  it("rejects a child date of birth in the future", () => {
    const result = inquiryInput.safeParse({ ...base, childDateOfBirth: "2999-01-01" });
    expect(result.success).toBe(false);
  });

  it("accepts a past child date of birth", () => {
    const result = inquiryInput.safeParse({ ...base, childDateOfBirth: "2023-05-10" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.childDateOfBirth).toBeInstanceOf(Date);
  });

  it("rejects an overly long message", () => {
    const result = inquiryInput.safeParse({ ...base, message: "x".repeat(2001) });
    expect(result.success).toBe(false);
  });
});
