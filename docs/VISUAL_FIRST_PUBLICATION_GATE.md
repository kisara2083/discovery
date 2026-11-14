# DISCOVERY Public Visual first-publication boundary (v8)

## Scope and authority

- This is the final Public-side safety gate, **not** a substitute for the
  Private Scheduled producer's source-first same-occurrence Visual closure.
- The authoritative acquisition, quotation/rights, identity and display
  contracts remain `PUBLIC_VISUAL_SPEC.md`, `PUBLIC_VISUAL_V8.md` and
  `public_visual_policy.json` in Private `kisara2083/ChatGPT_DB`.
- Immutable historical publication sequences through **104** are grandfathered
  in; requests **105 onward** are subject to the v8 ingress contract, whether
  the operation is NEW or UPDATE. This is a one-time migration boundary, not an
  article-specific exception or a future-debt retry window.

## Publication preflight

`scripts/visual_contract.py` is invoked from both direct and saved-asset
hydrating publication paths before `data/public-data.json` or
`data/publication-state.json` can change.

1. Require v8 `display_selection`, a bound Card primary and Detail primary,
   and a safe deterministic `world_card` as final Card fallback.
2. Require selected images/media to bind to actual exported candidate keys.
   Provider media must have a canonical provider URL with the exact provider
   ID used by the browser player; X/Google Books remain Detail-only.
3. Do not permit World to displace usable Card media or an image. Do not permit
   a reviewed subject-correct tier 1–4 still to lose to a Card embed, nor a
   tier 5 weak still to displace a reviewed Card embed.
4. Do not permit Detail World to displace usable Detail imagery/media. Detail
   may have a World sentinel only when no real Detail visual is available; the
   v8 browser intentionally does **not** render World as Detail media.
5. On any mismatch, fail before Public article/receipt mutation. The original
   Issue remains an actionable failed request rather than silently publishing
   a blank/misranked Card. Do **not** invent a license, route completion or
   image candidate at the Public boundary.

## Historical display compatibility

The browser's legacy fallback uses only already-public title, summary and
optional date to render a World Card when a retained article has neither
renderable media nor `world_card` metadata. It never changes the Public
dataset, receipt, article order or factual text, and never repeats World on the
Detail page. This is display compatibility, not a new Visual maintenance
pipeline.

## What this does not prove

The Public snapshot cannot independently prove that the Scheduled producer
actually inspected every upstream source or that a missing still was lawfully
unavailable. That proof remains in the pinned Private producer's checked-route,
review and native terminal preflight. Missing stills must not automatically be
converted into copyright approval or inferred as a correct search result.
Media-only releases may remain valid after verified route exhaustion; an
arbitrary media-count threshold is not a substitute for evidence.

## Verification

- `python -m unittest discover -s scripts -p 'test_*.py'`: Public incoming
  request/receipt tests, including cutover and rollback-on-failure, plus
  `test_visual_contract.py`.
- `node --check assets/app.js && node --check assets/editorial-refresh.js`.
- Existing Playwright reading-experience suite verifies that an old blank
  article generates a World Card while Detail remains text-first.
- No action in this package launches a workflow, creates a new scheduled task,
  performs research, changes design proportions, or modifies Private state.
