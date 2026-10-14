import { useParams } from 'react-router-dom';
import { identifierOf } from '../../shared/api/note-address';

/**
 * The canonical identifier of the notebook the route is in, or an empty string
 * when the segment is not one. `NotebookLayout` answers not-found before
 * rendering anything under a segment that is not an identifier, so every page
 * inside it holds a valid one.
 */
export function useNotebookId(): string {
  const { notebookId } = useParams();
  return identifierOf(notebookId) ?? '';
}
