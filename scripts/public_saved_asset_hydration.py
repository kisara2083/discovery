"""Hydrate content-addressed saved Visual assets under strict public-safe rules."""
from __future__ import annotations

import hashlib
import ipaddress
import re
import socket
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

ASSET = re.compile(r"assets/images/([a-f0-9]{64})\.(jpg|png|gif|webp)")
MAX_BYTES = 10_000_000
ARK_FANKIT = "https://www.arknights.jp/fankit/"


def fail(code):
    raise ValueError(code)


def _public_host(host):
    if not host:
        fail("asset_url_host")
    try:
        literal = ipaddress.ip_address(host)
        if not literal.is_global:
            fail("asset_private_ip")
        return
    except ValueError:
        pass
    try:
        addresses = {row[4][0] for row in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)}
    except OSError as exc:
        raise ValueError("asset_dns") from exc
    if not addresses or any(not ipaddress.ip_address(value).is_global for value in addresses):
        fail("asset_private_ip")


def _safe_url(value):
    if not isinstance(value, str) or len(value) > 2048:
        fail("asset_url")
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        fail("asset_url")
    _public_host(parsed.hostname)
    return parsed


def _eligible(image):
    if image.get("mode") != "saved":
        return False
    original = image.get("original_url")
    source_page = image.get("source_page")
    if not original or not source_page:
        return False
    op = _safe_url(original)
    _safe_url(source_page)

    # Official Arknights fan-kit: the Private selector already limited this to
    # the reviewed inventory; Public independently restricts source/host/path.
    if source_page == ARK_FANKIT:
        return (op.hostname == "webusstatic.yo-star.com"
                and op.path.startswith("/ark_jp_web/assets/"))

    # Reviewed quotation route. The request carries only the Public display
    # projection; the producer/Private side retains gate evidence/history.
    quote = image.get("quote_context")
    provenance = image.get("visual_provenance") or {}
    if isinstance(quote, dict):
        return (quote.get("display_mode") == "saved"
                and quote.get("source_page") == source_page
                and provenance.get("source_revalidated") is True)

    # Licensed Commons/Openverse style saved assets retain public attribution.
    if isinstance(image.get("attribution"), dict):
        return True
    return False


def _format(blob):
    if blob.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if blob.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if blob[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if blob.startswith(b"RIFF") and blob[8:12] == b"WEBP":
        return "webp"
    fail("asset_format")


def fetch(original_url):
    _safe_url(original_url)
    request = urllib.request.Request(
        original_url, headers={"User-Agent": "DISCOVERY-publication/1.0"})
    with urllib.request.urlopen(request, timeout=20) as response:
        _safe_url(response.url)
        blob = response.read(MAX_BYTES + 1)
    if len(blob) > MAX_BYTES:
        fail("asset_size")
    return blob, _format(blob)


def hydrate(article, repo_root, downloader=fetch):
    """Return newly materialized paths; existing bytes are hash-verified."""
    root = Path(repo_root)
    created = []
    for image in article.get("images", []):
        if image.get("mode") != "saved":
            continue
        match = ASSET.fullmatch(str(image.get("url", "")))
        if not match:
            fail("asset_path")
        target = root / image["url"]
        if target.is_file():
            if hashlib.sha256(target.read_bytes()).hexdigest() != match.group(1):
                fail("asset_existing_digest")
            continue
        if not _eligible(image):
            fail("asset_hydration_not_allowed")
        blob, ext = downloader(image.get("original_url"))
        if ext != match.group(2) or hashlib.sha256(blob).hexdigest() != match.group(1):
            fail("asset_hydration_digest")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(blob)
        created.append(image["url"])
    return created
