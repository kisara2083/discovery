"""Forward-only Public visual boundary for new publication requests.

The Private producer owns source-first search closure and lawful review. This
defence-in-depth check prevents an unrenderable/contradictory Public snapshot
from being accepted. Do not use it as evidence that acquisition was completed.
"""
# Sequence 104 is the last historical pre-gate publication. Older immutable
# requests/snapshots remain valid; all subsequent requests use this contract.
FIRST_VISUAL_GATE_SEQUENCE = 105
CARD_EMBEDS = {'youtube_embed', 'spotify_embed', 'steam_embed'}


def tier(candidate):
    """Match v8 selector and the browser's visualTier medium ordering."""
    p = candidate.get('visual_provenance') or {}
    if p.get('article_match') is True:
        return 1
    if p.get('relation') in ('venue_reference', 'related_project', 'unknown'):
        return 5
    if p.get('entity_match') is True and p.get('relation') != 'reference_same_entity':
        return 3
    if p.get('entity_match') is True and p.get('relation') != 'venue_reference':
        return 4
    return 5


def card_capable(media):
    p = media.get('visual_provenance') or {}
    return (media.get('type') in CARD_EMBEDS
            and p.get('official_source') is True
            and p.get('source_revalidated') is True
            and p.get('entity_match') is True)


def validate_first_visual(article, fail):
    world = article.get('world_card')
    if not isinstance(world, dict):
        fail('visual_world_fallback_missing')
    d = article.get('display_selection')
    if not isinstance(d, dict) or d.get('selector_version') != 8:
        fail('visual_v8_selection_required')
    card, detail = d.get('card_primary'), d.get('detail_primary')
    if not card or not detail:
        fail('visual_primary_missing')

    images = {'image:' + (i.get('original_url') or i['url']): i
              for i in article['images']}
    media = {'media:' + m.get('canonical_url', ''): m
             for m in article.get('media', []) if m.get('canonical_url')}
    card_media = {k for k, m in media.items() if card_capable(m)}
    strong_images = {k for k, i in images.items() if tier(i) <= 4}

    def bound(ref, surface):
        if ref['kind'] == 'world_card':
            if ref['key'] != world['key']:
                fail('visual_world_binding')
            return
        if ref['kind'] == 'image' and ref['key'] in images:
            return
        if ref['kind'] == 'media' and ref['key'] in media:
            if surface == 'card' and ref['key'] not in card_media:
                fail('visual_card_media_not_capable')
            return
        fail('visual_selection_unbound')

    bound(card, 'card')
    bound(detail, 'detail')
    for ref in d['detail_secondary']:
        bound(ref, 'secondary')
    if card['kind'] == 'world_card' and (images or card_media):
        fail('visual_world_not_last')
    if card['kind'] == 'media' and strong_images:
        fail('visual_card_static_priority')
    if card['kind'] == 'image' and card['key'] not in strong_images and card_media:
        fail('visual_card_weak_static_priority')
    if detail['kind'] == 'world_card' and (images or media):
        fail('visual_detail_world_not_last')
