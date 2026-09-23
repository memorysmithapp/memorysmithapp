// A module of its own, with nothing else in it, so a component that only
// formats can import it without loading the resources and the stored choice.

/**
 * The locale of the interface as a BCP 47 tag, which is what `Intl` takes.
 *
 * They are not the same string. The interface names its locales `en_US` and
 * `pt_BR`, with an underscore, because that is how the resources are keyed —
 * and `new Intl.DateTimeFormat('en_US')` does not fail softly: it throws
 * `RangeError: Invalid language tag`, which took the whole screen down the
 * first time a date was formatted in a transfer (#161). Two screens had each
 * written the conversion out by hand; this is the third, and the last.
 */
export function intlLocale(language: string): string {
  return language === 'pt_BR' ? 'pt-BR' : 'en-US';
}
