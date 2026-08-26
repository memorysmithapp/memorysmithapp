import { useEffect, useRef, useState, type ReactNode } from 'react';

interface CardCarouselProps {
  prevLabel: string;
  nextLabel: string;
  children: ReactNode;
}

// A horizontally scrolling card row with paging arrows. The arrows only show
// when there is content on that side, and disappear entirely when every card
// fits; the row itself stays scrollable by wheel, trackpad and drag.
export function CardCarousel({ prevLabel, nextLabel, children }: CardCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  function update() {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  // Children arrive asynchronously (the vault list loads), so re-measure on
  // every render besides reacting to scroll and resize.
  useEffect(() => {
    update();
  });

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
  }, []);

  function page(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(el.clientWidth - 120, 240), behavior: 'smooth' });
  }

  return (
    <div className="card-carousel">
      {canPrev && (
        <button type="button" className="carousel-arrow left" aria-label={prevLabel} onClick={() => page(-1)}>
          ‹
        </button>
      )}
      <div className="vault-grid" ref={trackRef}>
        {children}
      </div>
      {canNext && (
        <button type="button" className="carousel-arrow right" aria-label={nextLabel} onClick={() => page(1)}>
          ›
        </button>
      )}
    </div>
  );
}
