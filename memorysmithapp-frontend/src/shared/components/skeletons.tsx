import { SkeletonBar, SkeletonRegion, SkeletonText } from './Skeleton';

/**
 * One placeholder per surface, matched to the frame the real content occupies.
 *
 * They live together rather than beside each component because the point of
 * them is consistency: the same primitive, the same rhythm, and one place to
 * look when a real surface changes shape and its placeholder stops matching.
 * A generic grey box used everywhere would be the failure this file exists to
 * avoid, and so would six hand-rolled ones.
 */

/**
 * A card of a shelf (#418): the drawing, the name, what it is and its footer,
 * in the frame of the card itself, so a grid of them is the grid that comes.
 */
export function ShelfCardSkeleton() {
  return (
    <div className="notebook-card notebook-card-skeleton" aria-hidden="true">
      <SkeletonBar width="120px" height="40px" />
      <div className="notebook-card-text">
        <SkeletonBar width="70%" height="1.2rem" />
        <SkeletonText lines={2} />
      </div>
      <footer>
        <SkeletonBar width="45%" height="0.8rem" />
        <SkeletonBar width="4rem" height="0.8rem" />
      </footer>
    </div>
  );
}

/** A shelf while it reads (#421): the notebooks, the models, the community. */
export function ShelfSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <SkeletonRegion>
      <div className="shelf-grid">
        {Array.from({ length: cards }, (_, index) => (
          <ShelfCardSkeleton key={index} />
        ))}
      </div>
    </SkeletonRegion>
  );
}

/** Rows of a list: transfers, the people of a share, what an export offers (#421). */
export function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <SkeletonRegion>
      <div className="rows-skeleton">
        {Array.from({ length: rows }, (_, index) => (
          <SkeletonBar key={index} width="100%" height="2.75rem" />
        ))}
      </div>
    </SkeletonRegion>
  );
}

/** The fields of a form, a label over each (#421). */
export function FieldsSkeleton({ fields = 1 }: { fields?: number }) {
  return (
    <SkeletonRegion>
      <div className="fields-skeleton">
        {Array.from({ length: fields }, (_, index) => (
          <div className="fields-skeleton-field" key={index}>
            <SkeletonBar width="8rem" height="0.8rem" />
            <SkeletonBar width="100%" height="2.5rem" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/**
 * A page that reads one thing (#421): a model of the community, a version:
 * its title, what it says of itself, and the list under a heading.
 */
export function PageSkeleton() {
  return (
    <SkeletonRegion>
      <div className="page-skeleton">
        <SkeletonBar width="55%" height="2rem" />
        <SkeletonText lines={3} />
        <SkeletonBar width="30%" height="1.3rem" />
        <div className="rows-skeleton">
          {Array.from({ length: 3 }, (_, index) => (
            <SkeletonBar key={index} width="100%" height="2.75rem" />
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** A model (#421): its tabs, and the part of it the first tab holds. */
export function ModelSkeleton() {
  return (
    <SkeletonRegion>
      <div className="page-skeleton">
        <div className="tabs-skeleton">
          {['5rem', '6.5rem', '5.5rem'].map((width, index) => (
            <SkeletonBar key={index} width={width} height="2rem" />
          ))}
        </div>
        <SkeletonText lines={4} />
        <SkeletonBar width="40%" height="1.2rem" />
        <SkeletonText lines={2} />
      </div>
    </SkeletonRegion>
  );
}

/**
 * The space of the subscription while its answer is on the way (#198): the
 * total, the bar and the four rows of the table, in the card they will fill,
 * so nothing below moves when the numbers arrive.
 */
export function SpaceSkeleton() {
  return (
    <SkeletonRegion>
      <div className="home-space-card">
        <div className="home-space-total">
          <SkeletonBar width="9rem" height="2.4rem" />
          <SkeletonBar width="100%" height="14px" />
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonBar key={index} width="100%" height="1rem" />
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** The tree in the sidebar. The frame around it is never withheld. */
export function FolderTreeSkeleton() {
  const indents = [0, 1, 1, 0, 1, 2, 1, 0];
  return (
    <SkeletonRegion>
      <div className="tree-skeleton">
        {indents.map((depth, index) => (
          <div className="tree-skeleton-row" key={index} style={{ paddingLeft: `${depth}rem` }}>
            <SkeletonBar width={`${70 - depth * 12}%`} height="0.9rem" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/** A note: its name, its properties and its body. */
export function NoteSkeleton() {
  return (
    <SkeletonRegion>
      <article className="content-pane">
        <SkeletonBar width="30%" height="0.8rem" />
        <SkeletonBar width="65%" height="2rem" />
        <SkeletonText lines={4} />
        <SkeletonBar width="45%" height="1.2rem" />
        <SkeletonText lines={5} />
      </article>
    </SkeletonRegion>
  );
}

/** The body of one template card, inside a box that is already drawn. */
export function TemplateSkeleton() {
  return (
    <SkeletonRegion>
      <SkeletonText lines={3} />
    </SkeletonRegion>
  );
}

/** The graph canvas, which is one large area and not a list of anything. */
export function GraphSkeleton() {
  return (
    <SkeletonRegion>
      <div className="graph-skeleton" />
    </SkeletonRegion>
  );
}

/**
 * The application, while the session resolves. It replaces 60vh of nothing —
 * the first thing every page load and every deep link used to show.
 */
export function AppSkeleton() {
  return (
    <SkeletonRegion>
      <div className="app-skeleton">
        <header className="app-skeleton-bar">
          <SkeletonBar width="2rem" height="2rem" round />
          <SkeletonBar width="12rem" height="1.2rem" />
        </header>
        <div className="app-skeleton-body">
          <SkeletonText lines={3} />
        </div>
      </div>
    </SkeletonRegion>
  );
}
