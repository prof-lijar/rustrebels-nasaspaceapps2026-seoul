/**
 * Drawn icons instead of the characters ↗ and ▶: phones replace those characters with
 * colour emoji, so they looked different from one device to the next.
 * Both take the size and colour of the text around them.
 */
const base = { width: "1em", height: "1em", viewBox: "0 0 16 16", "aria-hidden": true, focusable: false, style: { display: "inline-block", flex: "none", alignSelf: "center", verticalAlign: "-0.1em" } } as const;

/** Arrow pointing up and right: the link leaves the page. */
export function ArrowOut() {
  return (
    <svg {...base} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square">
      <path d="M4 12 12 4M5.5 4H12v6.5" />
    </svg>
  );
}

/** Play triangle. */
export function PlayIcon() {
  return (
    <svg {...base} fill="currentColor">
      <path d="M4 2.5v11l9.5-5.5z" />
    </svg>
  );
}
