#!/usr/bin/env python3
"""Convert one bound JP Fan Kit reroll into the existing Visual maintenance request.

The issue persistently fixes one URL before any IO. The real Visual-only,
article-digest-locked applier remains the only publication mutation path.
"""
from __future__ import annotations

import copy
import hashlib
import json
import re
import sys
from pathlib import Path

import apply_publication_request as publication
import apply_visual_maintenance_request as maintenance
import public_saved_asset_hydration as hydration

KIND = "DISCOVERY_JP_FANKIT_REROLL_V1"
REQUEST_KEYS = {"kind", "schema_version", "article_id", "expected_article_digest", "chosen_url"}


def fan(image):
    return (image.get("source_page") == hydration.ARK_FANKIT
            and image.get("mode") == "saved" and image.get("original_url"))


def build(req_path, data_path, downloader=hydration.fetch):
    req = json.loads(req_path.read_text(encoding="utf-8"))
    if not isinstance(req, dict) or set(req) != REQUEST_KEYS:
        raise ValueError("jp_fankit_request_fields")
    if req["kind"] != KIND or req["schema_version"] != 1:
        raise ValueError("jp_fankit_request_version")
    article_id = req["article_id"]
    if not re.fullmatch(r"a-[0-9a-f]{24}", article_id):
        raise ValueError("jp_fankit_article_id")
    expected = req["expected_article_digest"]
    if not re.fullmatch(r"[0-9a-f]{64}", expected):
        raise ValueError("jp_fankit_article_digest")
    chosen = req["chosen_url"]
    if chosen not in hydration._jp_wallpaper_urls():
        raise ValueError("jp_fankit_url_not_allowlisted")
    data = json.loads(data_path.read_text(encoding="utf-8"))
    matches = [a for a in data["articles"] if a.get("id") == article_id]
    if len(matches) != 1:
        raise ValueError("jp_fankit_article_count")
    current = matches[0]
    if maintenance.digest(current) != expected:
        raise ValueError("article_digest_mismatch")

    images = current.get("images", [])
    old = [i for i in images if fan(i)]
    if len(old) != 1:
        raise ValueError("jp_fankit_one_existing_asset_required")
    old_url = old[0]["original_url"]
    old_key = "image:" + old_url
    selection = copy.deepcopy(current["display_selection"])
    primaries = [selection.get("card_primary"), selection.get("detail_primary")]
    if not any(r and r["key"] == old_key for r in primaries):
        raise ValueError("jp_fankit_primary_required")

    # Derive a digest from the actual downloaded bytes; never fabricate a hash
    # from an official URL and never fetch a Global/sticker/unobserved source.
    blob, ext = downloader(chosen)
    if not isinstance(blob, bytes) or not blob or len(blob) > hydration.MAX_BYTES:
        raise ValueError("jp_fankit_asset_size")
    if ext != hydration._format(blob):
        raise ValueError("jp_fankit_asset_format")
    name = "assets/images/" + hashlib.sha256(blob).hexdigest() + "." + ext
    image = copy.deepcopy(old[0])
    image.update(url=name, original_url=chosen,
                 caption="アークナイツ公式ファンキットの壁紙（記事固有の画像ではありません）",
                 source_page=hydration.ARK_FANKIT, mode="saved", framing="contain",
                 relation="reference_same_entity")
    image.pop("quote_context", None)
    if image.get("visual_provenance"):
        image["visual_provenance"].update(
            relation="official_entity", official_source=True, source_revalidated=True,
            entity_match=True, article_match=False, authority_class="official_entity")
    first = next(n for n, i in enumerate(images) if fan(i))
    replacements = [i for i in images if not fan(i)]
    replacements.insert(first, image)
    for ref in [selection.get("card_primary"), selection.get("detail_primary"),
                *selection.get("detail_secondary", [])]:
        if ref and ref["key"] == old_key:
            ref["key"] = "image:" + chosen
    visual = {
        "images": replacements,
        "media": copy.deepcopy(current.get("media", [])),
        "world_card": copy.deepcopy(current.get("world_card")),
        "display_selection": selection,
    }
    new_req = {
        "kind": "DISCOVERY_VISUAL_MAINTENANCE_REQUEST_V1",
        "schema_version": 1,
        "article_id": article_id,
        "expected_article_digest": expected,
        "visual": visual,
        "maintenance_id": maintenance.bound_maintenance_id(article_id, expected, visual),
    }
    maintenance.validate_request(new_req)
    projected = copy.deepcopy(current)
    projected.update(visual)
    taxonomy = {g["id"] for g in data.get("taxonomy", [])}
    publication.validate_article(projected, taxonomy)
    # All validations above are pre-write; this asset stays in the ephemeral
    # workspace until the existing atomic maintenance commit succeeds.
    target = data_path.parent.parent / name
    if target.is_file():
        if hashlib.sha256(target.read_bytes()).hexdigest() != hashlib.sha256(blob).hexdigest():
            raise ValueError("jp_fankit_existing_asset_digest")
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(blob)
    req_path.write_text(json.dumps(new_req, ensure_ascii=False, sort_keys=True) + "\n",
                        encoding="utf-8")
    return new_req


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: build_jp_fankit_reroll_request.py REQUEST DATA")
    build(Path(sys.argv[1]), Path(sys.argv[2]))
