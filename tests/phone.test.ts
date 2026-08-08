import { describe, expect, it } from "vitest";

import { phone, requiredPhone } from "@/lib/validation";

/**
 * Egyptian mobile validation.
 *
 * The rule reached the app because a string of zeros was accepted as a phone
 * number. The number is optional, but when given it must be a real Egyptian
 * mobile: 11 digits, starting 01, with a live carrier prefix. Formatting is
 * forgiven and an international +20 prefix is normalised to the local form, so
 * these assert both the acceptances and the exact stored shape.
 */

function parse(input: string) {
  return phone.safeParse(input);
}

/**
 * Arabic-Indic digits.
 *
 * A parent using the Arabic site types on an Arabic keyboard, which produces
 * ٠١٢٣٤٥٦٧٨٩ rather than ASCII. `\d` is ASCII-only, so before normalisation
 * those characters were stripped as punctuation and the number was rejected.
 */
describe("phone — Arabic-Indic digits", () => {
  it("accepts a number typed in Arabic-Indic digits and stores it in ASCII", () => {
    const result = parse("٠١٠١٢٣٤٥٦٧٨");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("01012345678");
  });

  it("accepts Persian/Urdu digits too", () => {
    const result = parse("۰۱۰۱۲۳۴۵۶۷۸");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("01012345678");
  });

  it("normalises a mixed Arabic/ASCII number with formatting", () => {
    const result = parse("٠١٠ ١٢٣٤ 5678");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("01012345678");
  });

  it("folds an Arabic-Indic +20 international form to the local one", () => {
    const result = parse("+٢٠ ١٠١٢٣٤٥٦٧٨");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("01012345678");
  });

  it("still rejects an invalid number written in Arabic-Indic digits", () => {
    expect(parse("٠٠٠٠٠٠٠٠٠٠٠").success).toBe(false);
  });

  it("applies the same normalisation to a required phone", () => {
    const result = requiredPhone.safeParse("٠١٠١٢٣٤٥٦٧٨");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("01012345678");
  });
});

describe("phone", () => {
  it("accepts every real carrier prefix and stores 11 local digits", () => {
    for (const number of [
      "01012345678", // 010 Vodafone
      "01112345678", // 011 Etisalat
      "01212345678", // 012 Orange
      "01512345678", // 015 WE
    ]) {
      const result = parse(number);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe(number);
    }
  });

  it("strips spaces, dashes and parentheses before validating", () => {
    for (const formatted of [
      "010 1234 5678",
      "010-1234-5678",
      "(010) 1234 5678",
    ]) {
      const result = parse(formatted);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe("01012345678");
    }
  });

  it("folds an international +20 / 0020 prefix back to the local form", () => {
    for (const international of ["+20 100 000 0000", "0020 100 000 0000"]) {
      const result = parse(international);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe("01000000000");
    }
  });

  it("treats an empty value as absent rather than invalid", () => {
    const result = parse("");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeUndefined();
  });

  it("rejects the exact input that started this: a string of zeros", () => {
    // 00000000000 does not start 01, so it is not a mobile number.
    expect(parse("00000000000").success).toBe(false);
  });

  it("rejects wrong lengths, landlines and non-carrier prefixes", () => {
    for (const bad of [
      "0101234567", // 10 digits — too short
      "010123456789", // 12 digits — too long
      "0223456789", // Cairo landline, no 01 prefix
      "01312345678", // 013 is not a live carrier prefix
      "01412345678", // 014 either
      "1012345678", // missing the leading 0
      "phone", // not a number at all
    ]) {
      expect(parse(bad).success).toBe(false);
    }
  });
});
