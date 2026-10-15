import type { NotebookSummary } from '../../shared/types/api';

/**
 * The notebooks by name, compared the way the reader's language compares
 * them: *Ética* between *Estratégia* and *Execução*, not after *Z*. The API
 * answers in the order the notebooks were created, which is an order nobody
 * looks for. A notebook shared with the reader takes its place among them by
 * the same order (#256).
 */
export function byName<T extends Pick<NotebookSummary, 'name'>>(
  notebooks: readonly T[],
  locale: string,
): T[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  return [...notebooks].sort((a, b) => collator.compare(a.name, b.name));
}
