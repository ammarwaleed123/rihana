import { describe, expect, it } from "vitest";

import { inquiryInput } from "@/lib/validation";

/**
 * Validation for the public admissions inquiry. The honeypot and rate limit live
 * in the server action; this covers the pure input schema.
 */

const base = {
  parentName: "Amira Hassan",
  email: "amira@example.com",
  phone: "",
  childFirstName: "",
  childDateOfBirth: "",
  preferredStartDate: "",
  message: "",
};

describe("inquiryInput", () => {
  it("accepts a minimal enquiry (just name + email)", () => {
    const result = inquiryInput.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parentName).toBe("Amira Hassan");
      expect(result.data.phone).toBeUndefined();
      expect(result.data.childDateOfBirth).toBeNull();
      expect(result.data.message).toBeUndefined();
    }
  });

  it("rejects a missing name", () => {
    expect(inquiryInput.safeParse({ ...base, parentName: "" }).success).toBe(false);
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
