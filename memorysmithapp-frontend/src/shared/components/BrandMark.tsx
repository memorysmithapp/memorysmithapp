/**
 * The brand lockup: the symbol plus the wordmark. It exists as its own
 * component because it appears twice, in the app header and at the top of the
 * navigation drawer, which covers that header on a narrow screen.
 */
export function BrandMark() {
  return (
    <>
      <img src="/symbol.svg" alt="" className="brand-symbol" />
      <span className="brand-word">
        MemorySmith<span className="brand-suffix">.app</span>
      </span>
    </>
  );
}

/**
 * The brand at the head of a screen that stands outside the shell: the sign-in,
 * the page the sign-in returns to and the tab that generates a PDF. The symbol
 * over the wordmark, the way the sign-in drew it, so no such screen shows the
 * word alone (#544). The symbol in colour serves the light and the dark theme
 * alike, as the brand book draws it.
 */
export function BrandHeading() {
  return (
    <>
      <img src="/symbol.svg" alt="" className="login-symbol" />
      <h1 className="brand-word">
        MemorySmith<span className="brand-suffix">.app</span>
      </h1>
    </>
  );
}
