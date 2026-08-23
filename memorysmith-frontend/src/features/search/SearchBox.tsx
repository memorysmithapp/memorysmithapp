import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FolderNode, VaultStructure } from '../../shared/types/api';

type SearchMode = 'index' | 'graph';

interface FlatNote {
  slug: string;
  title: string;
  folderPath: string;
}

function flatten(folders: FolderNode[], trail: string[] = []): FlatNote[] {
  return folders.flatMap((folder) => {
    const path = [...trail, folder.name];
    return [
      ...folder.notes.map((note) => ({ slug: note.slug, title: note.title, folderPath: path.join(' / ') })),
      ...flatten(folder.children, path),
    ];
  });
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

interface SearchBoxProps {
  vaultSlug: string;
  structure: VaultStructure;
}

export function SearchBox({ vaultSlug, structure }: SearchBoxProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('index');

  const notes = useMemo(() => flatten(structure.folders), [structure]);
  const results = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return [];
    return notes
      .filter((note) => normalize(note.title).includes(needle) || normalize(note.folderPath).includes(needle))
      .slice(0, 30);
  }, [notes, query]);

  return (
    <div className="search-box">
      <input
        type="search"
        value={query}
        placeholder={t('search.placeholder')}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query.trim() !== '' && (
        <div className="search-results">
          <div className="search-modes">
            <button type="button" className={mode === 'index' ? 'active' : ''} onClick={() => setMode('index')}>
              {t('search.modeIndex')}
            </button>
            <button type="button" className={mode === 'graph' ? 'active' : ''} onClick={() => setMode('graph')}>
              {t('search.modeGraph')}
            </button>
          </div>
          {mode === 'graph' ? (
            <p className="search-empty">{t('search.graphSoon')}</p>
          ) : results.length === 0 ? (
            <p className="search-empty">{t('search.empty')}</p>
          ) : (
            <ul>
              {results.map((note) => (
                <li key={note.slug}>
                  <Link to={`/vaults/${vaultSlug}/notes/${note.slug}`} onClick={() => setQuery('')}>
                    <span className="search-title">{note.title}</span>
                    <span className="search-path">{note.folderPath}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
