import type { ReactNode } from 'react';

/**
 * Two or three short options, one of them chosen (#201): the chosen one filled
 * in Tinta, Papel in the dark theme, because blue is for an action and a link
 * and "chosen" must never read as "clickable".
 *
 * Inside a menu the options are `menuitemradio`, which is what the arrows of
 * the menu move between; anywhere else they are a `radiogroup`.
 */
export function Segmented<V extends string>({
  label,
  options,
  value,
  onChange,
  inMenu = false,
}: {
  label: string;
  /** `disabled` offers an option that cannot be chosen yet, as a picture before there is one (#215). */
  options: ReadonlyArray<{ value: V; label: string; icon?: ReactNode; disabled?: boolean }>;
  value: V;
  onChange: (value: V) => void;
  inMenu?: boolean;
}) {
  return (
    <div className="segmented" role={inMenu ? 'group' : 'radiogroup'} aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role={inMenu ? 'menuitemradio' : 'radio'}
          aria-checked={option.value === value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
