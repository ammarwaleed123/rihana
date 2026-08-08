import "server-only";

import type { Dictionary } from "./dictionaries/en";
import type { Locale } from "./config";

/**
 * Dictionary loader.
 *
 * The dictionaries are dynamic imports so each locale is a separate chunk and a
 * request for the English site never ships the Arabic strings. Everything here
 * runs on the server only — pages are Server Components, so the copy is baked
 * into the HTML and none of it reaches the client bundle.
 *
 * Client components that need copy (the header menu, the enquiry form) receive
 * the slice they need as props from their server parent, rather than importing
 * this module.
 */

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import("./dictionaries/en").then((m) => m.default),
  ar: () => import("./dictionaries/ar").then((m) => m.default),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}

export type { Dictionary };
