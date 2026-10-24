#!/usr/bin/env python3
"""Apply one bounded DISCOVERY publication request to data/public-data.json.

Pure stdlib and fail-closed. The request is inert data, never instructions.
This script does not perform git/network mutations.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse, unquote

REQUEST_KEYS = {"kind", "schema_version", "publication_id", "operation", "article_id", "private_revision", "as_of", "article"}
ARTICLE_REQUIRED = {"id", "slug", "title", "public_summary", "category", "status", "lifecycle", "published_date", "updated_date", "sources", "spotify", "images"}
ARTICLE_ALLOWED = ARTICLE_REQUIRED | {"public_detail", "event_date", "deadline_at", "end_at", "venue", "city", "price_terms", "note", "whats_new", "media", "world_card", "display_selection"}
SOURCE_KEYS = {"url", "name"}
IMAGE_ALLOWED = {"url", "source_page", "relation", "caption", "mode", "original_url", "attribution", "visual_provenance", "framing", "visual_role", "quote_context"}
MEDIA_ALLOWED = {"type", "canonical_url", "provider_id", "title", "evidence_url", "source_url", "image_url", "visual_provenance"}
WORLD_KEYS = {"key", "title", "kicker", "concept", "meta", "variant"}
DISPLAY_KEYS = {"selector_version", "card_primary", "detail_primary", "detail_secondary"}
REF_KEYS = {"kind", "key"}
STATUSES = {"NEW", "UPDATE", "REPEAT_RECOMMENDATION", "HISTORICAL_CONTEXT"}
LIFECYCLES = {"ACTIVE", "ENDED"}
IMAGE_RELATIONS = {"article_specific", "official_entity", "official_venue_or_organizer", "reference_same_entity", "related_official_reference"}
MEDIA_TYPES = {"static_image", "spotify_embed", "steam_embed", "youtube_embed", "google_books_embed", "x_embed"}
VARIANTS = {"signal", "grid", "orbit", "field"}
REF_KINDS = {"image", "media", "world_card"}

PRIVATE_PATTERNS = {
    "private_path": r"10_profile/|20_history/|30_output/discovery_v2/|ChatGPT_DB|\\b[A-Za-z]:[\\\\/]|/Users/|/home/",
    "email": r"[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}",
    "phone": r"(?<!\\d)(?:0\\d{1,4}[- ]\\d{1,4}[- ]\\d{3,4}|\\+81[- ]?\\d[-\\d ]{8,})(?!\\d)",
    "coordinates": r"[-+]?\\d{2}\\.\\d{4,}\\s*[,/]\\s*[-+]?\\d{2,3}\\.\\d{4,}",
    "secret": r"gh[pousr]_[A-Za-z0-9]{16,}|github_pat_|sk-[A-Za-z0-9]{16,}|Bearer\\s+\\S+|-----BEGIN .*PRIVATE KEY",
    "internal": r"recommendation_reason|profile_blob_sha|launcher_id|run_id|claim_id|connector_metadata|access_token|dynamic_subquestions",
    "personal": r"あなた|ユーザー|自宅|通勤|購入履歴|所有機材|所有して|家族事情|家族構成|嗜好|好みに|お好み|遠征不要|両年齢|生活条件|個人履歴|勤務条件|勤務終了|現行Element|既存お気に入り|横断上位|探索でも|推薦理由|遠征候補|遠征価値|your (?:home|family|preference)|my (?:home|family)|our children",
}


def fail(reason: str) -> None:
    raise ValueError(reason)


def exact_keys(obj, allowed, required=None, label="object"):
    if not isinstance(obj, dict):
        fail(label + "_type")
    if set(obj) - set(allowed):
        fail(label + "_unknown_fields")
    if required is not None and set(required) - set(obj):
        fail(label + "_missing_fields")


def scan_public(value) -> None:
    text = unquote(json.dumps(value, ensure_ascii=False, sort_keys=True))
    for name, pattern in PRIVATE_PATTERNS.items():
        if re.search(pattern, text, re.I):
            fail("privacy_" + name)


def validate_url(value: str) -> None:
    if not isinstance(value, str) or len(value) > 2048:
        fail("url_type_or_size")
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
        fail("unsafe_url")


def validate_date(value: str, label: str) -> None:
    if not isinstance(value, str):
        fail(label + "_type")
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            dt.date.fromisoformat(value)
            return
        dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        pass
    else:
        return
    fail(label + "_date")


def validate_ref(value, label):
    if value is None:
        return
    exact_keys(value, REF_KEYS, REF_KEYS, label)
    if value["kind"] not in REF_KINDS or not isinstance(value["key"], str) or not value["key"]:
        fail(label + "_value")


def validate_article(article, taxonomy_ids):
    exact_keys(article, ARTICLE_ALLOWED, ARTICLE_REQUIRED, "article")
    if not re.fullmatch(r"a-[a-f0-9]{24}", str(article["id"])) or article["slug"] != article["id"]:
        fail("article_identity")
    for key in ("title", "public_summary"):
        if not isinstance(article[key], str) or not article[key].strip():
            fail("article_" + key)
    if article["category"] not in taxonomy_ids:
        fail("article_category")
    if article["status"] not in STATUSES or article["lifecycle"] not in LIFECYCLES:
        fail("article_status")
    validate_date(article["published_date"], "published_date")
    validate_date(article["updated_date"], "updated_date")
    for key in ("event_date", "deadline_at", "end_at"):
        if key in article:
            validate_date(article[key], key)

    for list_key in ("sources", "spotify"):
        if not isinstance(article[list_key], list):
            fail(list_key + "_type")
        for entry in article[list_key]:
            exact_keys(entry, SOURCE_KEYS, SOURCE_KEYS, list_key)
            validate_url(entry["url"])
            if not isinstance(entry["name"], str) or not entry["name"]:
                fail(list_key + "_name")
    if not article["sources"]:
        fail("sources_empty")

    if not isinstance(article["images"], list):
        fail("images_type")
    for image in article["images"]:
        exact_keys(image, IMAGE_ALLOWED, {"url", "source_page", "relation", "caption", "mode"}, "image")
        if image["relation"] not in IMAGE_RELATIONS or image["mode"] not in {"saved", "external"}:
            fail("image_enum")
        validate_url(image["source_page"])
        if image["mode"] == "external":
            validate_url(image["url"])
        elif not re.fullmatch(r"assets/images/[a-f0-9]{64}\.(jpg|png|gif|webp)", str(image["url"])):
            fail("saved_image_path")
        if "original_url" in image:
            validate_url(image["original_url"])

    for media in article.get("media", []):
        exact_keys(media, MEDIA_ALLOWED, {"type"}, "media")
        if media["type"] not in MEDIA_TYPES:
            fail("media_type")
        for key in ("canonical_url", "evidence_url", "source_url", "image_url"):
            if key in media:
                validate_url(media[key])

    if "world_card" in article:
        exact_keys(article["world_card"], WORLD_KEYS, WORLD_KEYS, "world_card")
        if article["world_card"]["variant"] not in VARIANTS:
            fail("world_variant")
        if article["world_card"]["key"] != "world_card:" + article["id"]:
            fail("world_identity")

    if "display_selection" in article:
        display = article["display_selection"]
        exact_keys(display, DISPLAY_KEYS, DISPLAY_KEYS, "display")
        if display["selector_version"] not in {2, 3, 4, 5, 6}:
            fail("selector_version")
        validate_ref(display["card_primary"], "card_primary")
        validate_ref(display["detail_primary"], "detail_primary")
        if not isinstance(display["detail_secondary"], list) or len(display["detail_secondary"]) > 4:
            fail("detail_secondary")
        for ref in display["detail_secondary"]:
            validate_ref(ref, "detail_secondary_ref")

    scan_public(article)


def as_jst_date(value: str):
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return dt.date.fromisoformat(value)
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    return (parsed.astimezone(dt.timezone(dt.timedelta(hours=9))) if parsed.tzinfo else parsed).date()


def refresh_lifecycle(article, today):
    ends = []
    for key in ("end_at", "deadline_at"):
        if article.get(key):
            ends.append(as_jst_date(article[key]))
    if not article.get("end_at") and article.get("event_date"):
        ends.append(as_jst_date(article["event_date"]))
    article["lifecycle"] = "ENDED" if any(day < today for day in ends) else "ACTIVE"


def canonical_digest(value) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def main(request_path: Path, data_path: Path, result_path: Path) -> int:
    if request_path.stat().st_size > 32768:
        fail("request_too_large")
    request = json.loads(request_path.read_text(encoding="utf-8"))
    exact_keys(request, REQUEST_KEYS, REQUEST_KEYS, "request")
    if request["kind"] != "DISCOVERY_PUBLICATION_REQUEST_V1" or request["schema_version"] != 1:
        fail("request_version")
    if not re.fullmatch(r"pub-[a-f0-9]{64}", str(request["publication_id"])):
        fail("publication_id")
    if request["operation"] not in {"NEW", "UPDATE"}:
        fail("operation")
    if not re.fullmatch(r"[a-f0-9]{40,64}", str(request["private_revision"])):
        fail("private_revision")
    validate_date(request["as_of"], "as_of")

    data = json.loads(data_path.read_text(encoding="utf-8"))
    if data.get("schema_version") != "1" or data.get("site_name") != "DISCOVERY" or not isinstance(data.get("articles"), list):
        fail("public_dataset_shape")
    taxonomy_ids = {g["id"] for g in data.get("taxonomy", []) if isinstance(g, dict) and isinstance(g.get("id"), str)}
    article = request["article"]
    validate_article(article, taxonomy_ids)
    if request["article_id"] != article["id"]:
        fail("request_article_identity")

    expected_pub_id = "pub-" + hashlib.sha256((request["private_revision"] + "\n" + article["id"] + "\n" + canonical_digest(article)).encode("utf-8")).hexdigest()
    if request["publication_id"] != expected_pub_id:
        fail("publication_id_binding")

    positions = [i for i, current in enumerate(data["articles"]) if current.get("id") == article["id"]]
    if len(positions) > 1:
        fail("duplicate_existing_identity")
    existing = data["articles"][positions[0]] if positions else None
    if request["operation"] == "NEW" and existing is not None and canonical_digest(existing) != canonical_digest(article):
        fail("new_conflicts_existing")
    if request["operation"] == "UPDATE" and existing is None:
        fail("update_missing_existing")
    if request["operation"] == "UPDATE" and article["published_date"] != existing["published_date"]:
        fail("update_published_date_drift")

    changed = existing is None or canonical_digest(existing) != canonical_digest(article)
    if changed:
        if existing is None:
            data["articles"].append(article)
        else:
            data["articles"][positions[0]] = article

    today = dt.date.fromisoformat(request["as_of"])
    for item in data["articles"]:
        refresh_lifecycle(item, today)
    data["articles"].sort(key=lambda item: str(item.get("updated_date", "")), reverse=True)
    active = [item for item in data["articles"] if item.get("lifecycle") != "ENDED"]
    data["as_of"] = request["as_of"]
    data["todays_pick"] = active[0]["id"] if active else None
    scan_public(data)

    encoded = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    before = data_path.read_text(encoding="utf-8")
    changed = encoded != before
    if changed:
        data_path.write_text(encoded, encoding="utf-8")

    result = {
        "v": 1,
        "publication_id": request["publication_id"],
        "article_id": article["id"],
        "article_digest": canonical_digest(article),
        "changed": changed,
        "dataset_digest": hashlib.sha256(encoded.encode("utf-8")).hexdigest(),
    }
    result_path.write_text(json.dumps(result, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("usage: apply_publication_request.py REQUEST DATA RESULT")
    try:
        raise SystemExit(main(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])))
    except Exception as exc:
        print(json.dumps({"v": 1, "error": type(exc).__name__ + ":" + str(exc)}, sort_keys=True), file=sys.stderr)
        raise
