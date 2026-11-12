import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './query-keys';
import { getModel } from './source';

/**
 * Whether a notebook is declared as a model, read from the query the sidebar
 * of the notebook already makes (#373), so asking it costs nothing more. A
 * notebook that is a model is served as a model from its every page — the
 * menu lights Models, and its trail starts there (#422). `undefined` while it
 * is still being read, so nothing is drawn as a notebook and then redrawn as a
 * model; `false` for no notebook at all.
 */
export function useIsModel(notebookId: string): boolean | undefined {
  const model = useQuery({
    queryKey: queryKeys.model(notebookId),
    queryFn: () => getModel(notebookId),
    enabled: notebookId !== '',
  });
  if (notebookId === '') return false;
  if (model.isPending) return undefined;
  // A model that cannot be read is no reason to draw the notebook as one.
  return model.data !== null && model.data !== undefined;
}
