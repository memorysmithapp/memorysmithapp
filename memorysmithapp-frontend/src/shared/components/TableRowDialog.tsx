import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';

/** One value of a row shown whole: its column's name and the value as the grid formats it. */
export interface TableRowField {
  readonly name: string;
  readonly value: string;
}

/**
 * A row of a table shown whole (#491). On the screen a cell holds one line and
 * a longer value ends in an ellipsis, so a click or Enter on a row opens it
 * here: each column's name and its full value, wrapping as long as it needs.
 * The Tables page and the `table` block of a note open the same dialog, the
 * block through the renderer's `openTableRow`.
 *
 * A row of `system-notes` is a note (#524), and `note` is where it is: the
 * dialog then leads to it.
 */
export function TableRowDialog({
  table,
  fields,
  note,
  onClose,
}: {
  table: string;
  fields: readonly TableRowField[];
  note?: string | null | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      open
      title={table}
      onClose={onClose}
      className="table-row-dialog"
      actions={
        note ? (
          <Link to={note} className="button is-primary" onClick={onClose}>
            {t('tables.openNote')}
          </Link>
        ) : undefined
      }
    >
      <dl className="table-row-fields">
        {fields.map((field) => (
          <div key={field.name} className="table-row-field">
            <dt>{field.name}</dt>
            <dd>{field.value === '' ? '—' : field.value}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
