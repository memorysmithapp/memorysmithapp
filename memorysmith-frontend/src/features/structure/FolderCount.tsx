import { useTranslation } from 'react-i18next';
import type { FolderNode } from '../../shared/types/api';
import { subtreeNoteCount } from './trail';

/**
 * The notes of a folder and of its whole subtree, with the split in the
 * tooltip. A folder that keeps its notes in subfolders read as empty from the
 * top, and the deeper a notebook was organized the more of it looked empty.
 * A subtree with no note shows nothing, as an empty folder always did.
 */
export function FolderCount({
  folder,
  className,
  label = false,
}: {
  folder: FolderNode;
  className: string;
  /** Written as "26 notes" rather than the bare number of the tree. */
  label?: boolean;
}) {
  const { t } = useTranslation();
  const total = subtreeNoteCount(folder);
  if (total === 0) return <span className={className} />;
  const below = total - folder.noteCount;
  return (
    <span
      className={className}
      title={
        folder.children.length > 0
          ? t('structure.noteCountSplit', { here: folder.noteCount, below })
          : undefined
      }
    >
      {label ? t('notebooks.noteCount', { count: total }) : total}
    </span>
  );
}
