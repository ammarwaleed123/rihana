import { LOCALE_INTL, type Locale } from "./config";

/**
 * Plural selection.
 *
 * English needs two forms; Arabic needs six (zero, one, two, few, many, other)
 * and picks between them by rules no amount of `n === 1 ? … : …` will capture —
 * "3 photos" and "13 photos" take *different* forms. `Intl.PluralRules` knows
 * those rules per locale, so the dictionary supplies the wordings and the
 * platform decides which one applies.
 *
 * Every entry must define `other`; the rest are optional and fall back to it, so
 * the English dictionary stays two short lines while Arabic can spell out all
 * six.
 */
export type Plural = {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
};

const cache = new Map<string, Intl.PluralRules>();

function rules(locale: Locale): Intl.PluralRules {
  const tag = LOCALE_INTL[locale];
  let found = cache.get(tag);
  if (!found) {
    found = new Intl.PluralRules(tag);
    cache.set(tag, found);
  }
  return found;
}

/**
 * Pick the right wording for `count` and substitute it for `{n}`.
 *
 * The number itself is formatted for the locale too, so Arabic gets ٣ rather
 * than 3 — mixing Western digits into Arabic text is the tell of a translation
 * that was bolted on.
 */
export function plural(forms: Plural, count: number, locale: Locale): string {
  const category = rules(locale).select(count) as keyof Plural;
  const template = forms[category] ?? forms.other;
  const formatted = new Intl.NumberFormat(LOCALE_INTL[locale]).format(count);
  return template.replace(/\{n\}/g, formatted);
}

/**
 * Fill `{placeholders}` in a dictionary string.
 *
 * Deliberately minimal: no expression evaluation, no HTML. Values are inserted
 * as plain text by React, so a child's name containing `<` is text, not markup.
 */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/**
 * Join a list the way the locale does — "Sara and Omar", "سارة وعمر".
 * Falls back to a plain join where `Intl.ListFormat` is unavailable.
 */
export function joinList(items: string[], locale: Locale): string {
  try {
    return new Intl.ListFormat(LOCALE_INTL[locale], {
      style: "long",
      type: "conjunction",
    }).format(items);
  } catch {
    return items.join(locale === "ar" ? " و" : " and ");
  }
}
