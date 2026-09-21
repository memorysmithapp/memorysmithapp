/**
 * The tab strip of the product (#161).
 *
 * A few things to look at, one at a time, and what is below the strip is the
 * one that is open. It was drawn for the chooser of a transfer, where it says
 * which species is being chosen, and it is the shape of that question wherever
 * it is asked: the filter of Transfers asked the same one — all of them, the
 * exports, the imports — with three `.chip`s, and a chip is a LABEL (#157), so
 * the one control of the page that switches a view was dressed as metadata,
 * blue on blue.
 *
 * **A tab that is not open stays visible and disabled**, never hidden: a tab
 * that disappears cannot be told from one that was never built (#160).
 */

/** One tab: what it says, whether it opens, and what it holds. */
export interface TabOf<K extends string> {
  readonly key: K;
  readonly label: string;
  /** Closed: drawn faded, and it takes no click. */
  readonly disabled?: boolean;
  /**
   * Lit, and counted. A tab is marked when what is in it is the reason the
   * screen cannot go on, which is the one case that earns the accent (#161).
   */
  readonly count?: number;
}

export function Tabs<K extends string>({
  id,
  label,
  tabs,
  active,
  onSelect,
  className,
}: {
  /**
   * What the strip and its panel are called in the markup: the tabs are
   * `{id}-tab-{key}` and the panel they open is `{id}-panel`, which whoever
   * draws the panel carries.
   */
  id: string;
  /** What the strip as a whole is asking, for whoever hears it read out. */
  label: string;
  tabs: ReadonlyArray<TabOf<K>>;
  active: K;
  onSelect: (key: K) => void;
  /** Where this strip lives, for what only that place needs. */
  className?: string;
}) {
  return (
    <div className={className ? `tabs ${className}` : 'tabs'} role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          id={`${id}-tab-${tab.key}`}
          aria-selected={active === tab.key}
          aria-controls={`${id}-panel`}
          disabled={tab.disabled ?? false}
          className={['tab', active === tab.key ? 'is-selected' : '', tab.count ? 'is-marked' : '']
            .filter(Boolean)
            .join(' ')}
          onClick={() => onSelect(tab.key)}
        >
          {tab.label}
          {tab.count ? <span className="tab-count">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
