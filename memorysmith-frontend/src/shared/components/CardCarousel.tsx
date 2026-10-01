import { Children, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CollapseIcon, ExpandIcon } from './icons';

interface CardCarouselProps {
  /** The title of the row, drawn on the same line as the rule and the arrows. */
  heading: ReactNode;
  prevLabel: string;
  nextLabel: string;
  /**
   * The cards spread over the page instead of one row (#257). Only the desktop
   * draws it: the caller passes false on a phone, whatever it remembers.
   */
  expanded?: boolean;
  /** Offers the button that spreads and gathers the cards, when given. */
  onExpandedChange?: (expanded: boolean) => void;
  expandLabel?: string;
  collapseLabel?: string;
  children: ReactNode;
}

/**
 * A row of cards that scrolls sideways (#198). On the desktop the title, a
 * rule and the ‹ › arrows share one line, and an arrow with nowhere to go is
 * disabled rather than gone; the row ends on the right margin of the page, a
 * card that does not fit cut there (#213). On a phone the row snaps card by
 * card, with dots under it and no arrows: the first on the left margin, the
 * last on the right one, and those between at the centre (#212).
 *
 * The row stays scrollable by wheel, trackpad, touch and keyboard whatever
 * the arrows say.
 *
 * Expanded, on the desktop, the cards wrap into rows that fill the page and
 * scroll vertically, and the same arrows turn to page up and down (#257).
 */
export function CardCarousel({
  heading,
  prevLabel,
  nextLabel,
  expanded = false,
  onExpandedChange,
  expandLabel,
  collapseLabel,
  children,
}: CardCarouselProps) {
  const { t } = useTranslation();
  const trackId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [active, setActive] = useState(0);
  const count = Children.count(children);

  function update() {
    const el = trackRef.current;
    if (!el) return;
    if (expanded) {
      setCanPrev(el.scrollTop > 4);
      setCanNext(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
      return;
    }
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    // The card nearest the centre of the row is the one in focus (#204), except
    // at the two ends, where the first and the last rest on the margins and a
    // neighbour may sit nearer the centre (#212).
    const cards = [...el.children] as HTMLElement[];
    if (el.scrollLeft <= 4 || el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) {
      setActive(el.scrollLeft <= 4 ? 0 : Math.max(cards.length - 1, 0));
      return;
    }
    const middle = el.scrollLeft + el.clientWidth / 2;
    let nearest = 0;
    let distance = Infinity;
    cards.forEach((card, index) => {
      const off = Math.abs(card.offsetLeft - el.offsetLeft + card.offsetWidth / 2 - middle);
      if (off < distance) {
        distance = off;
        nearest = index;
      }
    });
    setActive(nearest);
  }

  // Children arrive asynchronously (the notebook list loads), so re-measure on
  // every render besides reacting to scroll and resize.
  useEffect(() => {
    update();
  });

  // Re-bound when the cards spread or gather, so the listener reads the axis
  // the track scrolls on now.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [expanded]);

  function page(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    if (expanded) {
      el.scrollBy({ top: direction * Math.max(el.clientHeight - 120, 240), behavior: 'smooth' });
      return;
    }
    el.scrollBy({ left: direction * Math.max(el.clientWidth - 120, 240), behavior: 'smooth' });
  }

  function goTo(index: number) {
    const el = trackRef.current;
    const card = el?.children[index] as HTMLElement | undefined;
    if (!el || !card) return;
    // Where the row snaps that card: the ends to the margins, the rest centred.
    const last = el.children.length - 1;
    const left =
      index === 0
        ? 0
        : index === last
          ? el.scrollWidth - el.clientWidth
          : card.offsetLeft - el.offsetLeft + card.offsetWidth / 2 - el.clientWidth / 2;
    el.scrollTo({ left, behavior: 'smooth' });
  }

  return (
    <div className={expanded ? 'card-carousel is-expanded' : 'card-carousel'}>
      <div className="carousel-head">
        {heading}
        <span className="carousel-rule" aria-hidden="true" />
        <div className="carousel-arrows">
          <button
            type="button"
            className="icon-button"
            aria-label={prevLabel}
            disabled={!canPrev}
            onClick={() => page(-1)}
          >
            <span className="carousel-glyph" aria-hidden="true">
              ‹
            </span>
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={nextLabel}
            disabled={!canNext}
            onClick={() => page(1)}
          >
            <span className="carousel-glyph" aria-hidden="true">
              ›
            </span>
          </button>
          {onExpandedChange ? (
            <button
              type="button"
              className="icon-button carousel-expand"
              aria-label={expanded ? collapseLabel : expandLabel}
              title={expanded ? collapseLabel : expandLabel}
              aria-expanded={expanded}
              aria-controls={trackId}
              onClick={() => onExpandedChange(!expanded)}
            >
              {expanded ? <CollapseIcon /> : <ExpandIcon />}
            </button>
          ) : null}
        </div>
      </div>
      <div className="notebook-grid" id={trackId} ref={trackRef}>
        {children}
      </div>
      {count > 1 ? (
        <div className="carousel-dots">
          {Array.from({ length: count }, (_, index) => (
            <button
              key={index}
              type="button"
              className={index === active ? 'is-active' : undefined}
              aria-label={t('dashboard.goToNotebook', { number: index + 1 })}
              aria-current={index === active ? 'true' : undefined}
              onClick={() => goTo(index)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
