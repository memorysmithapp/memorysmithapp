/**
 * The brand lockup: the symbol plus the wordmark. It exists as its own
 * component because it appears twice, in the app header and at the top of the
 * navigation drawer, which covers that header on a narrow screen.
 */
export function BrandMark() {
  return (
    <>
      <img src="/symbol.svg" alt="" className="brand-symbol symbol-light" />
      <img src="/symbol-dark.svg" alt="" className="brand-symbol symbol-dark" />
      <span className="brand-word">
        MemorySmith<span className="brand-suffix">.app</span>
      </span>
    </>
  );
}
