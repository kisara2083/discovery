# DISCOVERY Detail: verified facts panel (2026-11-14)

## Previously agreed presentation contract

Keep the existing monochrome editorial design, fonts, accent colors, natural
Visual aspect ratios, three-column maximum Card grid, and the PC portrait
two-column **text-left / image-right** arrangement. No Card behavior or
first-publication timing changes.

On Detail, render the article title and metadata, short public lead, primary
Visual, then **AT A GLANCE** facts panel, then **ABOUT** explanatory text,
then additional Visual notes and sources. On >1199px portrait/near-square
split, the panel and ABOUT share the left text column alongside the right
image. At mobile widths they appear in the stated sequential DOM order.
Existing 8 fixed typed fields stay compatible, but only nonempty factual
values are shown. The panel may be absent when evidence is unavailable.

## New optional Public article fields

`public_facts`: up to 12 objects with exact keys:
- `key`: curated semantic key defined in `assets/detail-facts.js`
- `value`: brief, independently verified atomic claim
- `source_url`: exact URL of a verified item in article `sources[]`

`public_schedule`: up to 30 objects with:
- required `date` (YYYY-MM-DD) and `source_url`
- optional source-verified `time`, `venue`, `city`, `channel`

`public_schedule_complete` is an optional boolean set `true` only if the full schedule was verified; otherwise the UI labels the disclosure as '確認できた日程'.

Both arrays are optional and have closed-field guards at Public ingress.
The producer's canonical research capsule must independently check source
binding and permitted keys. Any mismatch is rejected before publication.

When a **complete** multi-session/venue list is verified, use an
accessible native `details` disclosure to show a brief date range and all
entries. Never label an incomplete list as "all sessions." If the producer
cannot verify completeness within the existing 16,384-byte total capsule
budget, retain the known fixed facts and official link without inventing
or silently truncating event sessions. The table aggregates source links
below the rows. Legacy fixed fields have only article-level source
provenance; they must not be presented as individually source-attested.

## Rollout boundary

Public can render the new fields as soon as a valid future publication
supplies them, without changing existing articles. It does not mine
`public_detail`, scrape sources, create new categories or perform
additional research in the browser.

The **Private** producer/exporter must separately be activated from the
canonical private main: `tools/public_incremental_native_v2_capsule.py`,
`tools/public_incremental_native_v2_promotion.py`,
`tools/public_incremental_runtime_guard.py`,
`tools/public_web.py`, `tools/public_incremental_projection.py`,
`00_system/discovery_v2/public_web_schema.json`,
`00_system/discovery_v2/PUBLIC_DETAIL_SPEC.md`, and
`deploy/render-mailbox/SCHEDULED_CAPSULE_PRODUCER_RULES.md`.
Do not treat a Public-only rollout as end-to-end producer completion.

Regression requirements: existing 104 articles stay valid, layout
and Visual are preserved, no fact count quota, invalid source/key/date
rejected with no publication writes, no duplicated schedule entries,
desktop/mobile reading order, and ordinary schedule/claim/READY/ACK
behavior unchanged. No new Scheduled Task, Action runner or paid service.
