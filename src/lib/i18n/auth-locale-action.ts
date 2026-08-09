"use server";

import { z } from "zod";

import { LOCALES } from "./config";
import { setLocaleCookie } from "./locale-cookie";

export type AuthLocaleState = { switched?: boolean };

/**
 * Language toggle for the signed-out auth pages.
 *
 * Separate from `updateLocaleAction` because there is nobody to save it to yet:
 * this writes the cookie alone, while the account version also writes the user
 * row. Once they sign in, `signInAction` overwrites the cookie from that row, so
 * a guess made here never outranks the account's real preference.
 *
 * No session check, and none is needed: the locale cookie carries no authority
 * (see locale-cookie.ts). The value is validated against the known locales so a
 * crafted POST can only ever store "en" or "ar". Nothing is redirected from user
 * input either — the client reloads the page it is already on — so there is no
 * open-redirect surface here at all.
 */
export async function setAuthLocaleAction(
  _prev: AuthLocaleState,
  formData: FormData,
): Promise<AuthLocaleState> {
  const parsed = z.enum(LOCALES).safeParse(formData.get("locale"));
  if (!parsed.success) return {};

  await setLocaleCookie(parsed.data);
  return { switched: true };
}
