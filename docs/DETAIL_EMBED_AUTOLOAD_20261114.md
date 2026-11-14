# Detail embed viewport autoload (2026-11-14)

## User-approved presentation change

All existing and future DISCOVERY article Detail embeds are
**zero-extra-tap to load**, irrespective of provider. This replaces the
earlier Detail explicit-click presentation rule; it does not override
rights, exact-provider URL checks, Card priority, quotation requirements,
article selection, or the usual five-Visual Detail ceiling.

- YouTube, Spotify, Steam, Google Books and X all start loading when their
  Detail player enters (or approaches) the viewport using
  IntersectionObserver. A no-observer fallback loads immediately.
- Loading a player is **not** permission to autoplay video or music.
  Playback remains an intentional user action at the provider UI.
- X runs the provider's official widget script on first visible instance;
  subsequent visible instances call the same widget renderer without
  separately loading the library. Provider blocking/cookie restrictions
  can still prevent external content from loading.
- Google Books uses the existing restricted same-origin viewer. Steam uses
  the existing sandboxed widget iframe. No platform URL is modified.
- Every provider keeps a source-page link for failures, but there is no
  site-specific "click to load" button.
- No Card embedding preference, typeface, theme, grid, World aspect ratio,
  player dimensions or publication sequence is changed here.

Regression: the existing Playwright reading-experience suite now covers
all five providers, no-click initialization, absence of autoplay, and the
retained official fallback link.

## One-time historical Visual maintenance

Only articles that at the cutover have **no Card Visual** or an **embedded
Card primary** are eligible. Their original facts, public summary/detail,
publication sequence, dates and source lists are immutable. Use the
dedicated Visual-maintenance request, exact article digest and receipt,
not a normal publication or a new recurring re-review. A historical
missing World is permitted only as an exact, deterministic projection of
already public title/summary; arbitrary World copy changes fail closed.
Every new still requires its own source-specific, relevance and
quotation/reuse review; a discovered file URL alone never suffices.
