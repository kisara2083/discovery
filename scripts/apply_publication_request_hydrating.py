#!/usr/bin/env python3
"""Pre-hydrate verified saved assets, then run the unchanged publication applier."""
from __future__ import annotations
import json
import sys
from pathlib import Path

import apply_publication_request as publication
from public_saved_asset_hydration import hydrate


def _normalize_public_sources(article):
    """Keep canonical Public source fields while rejecting hidden Private content."""
    publication.scan(article)
    normalized = dict(article)
    for key in ("sources", "spotify"):
        values = article.get(key)
        if not isinstance(values, list):
            publication.fail(key + "_type")
        public_values = []
        for value in values:
            if not isinstance(value, dict) or not isinstance(value.get("url"), str) or not isinstance(value.get("name"), str):
                publication.fail(key + "_shape")
            public_values.append({"url": value["url"], "name": value["name"]})
        normalized[key] = public_values
    return normalized


def main(reqp, datap, statep, resultp):
    req = json.loads(reqp.read_text(encoding="utf-8"))
    publication.exact(req, publication.REQUEST_KEYS, publication.REQUEST_KEYS, "request")
    if req.get("kind") != "DISCOVERY_PUBLICATION_REQUEST_V1" or req.get("schema_version") != 1:
        publication.fail("request_version")
    req["article"] = _normalize_public_sources(req["article"])
    reqp.write_text(json.dumps(req, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    data = json.loads(datap.read_text(encoding="utf-8"))
    tax = {g["id"] for g in data.get("taxonomy", [])
           if isinstance(g, dict) and isinstance(g.get("id"), str)}
    publication.validate_article(req["article"], tax)
    hydrate(req["article"], datap.parent.parent)
    return publication.main(reqp, datap, statep, resultp)


if __name__ == "__main__":
    if len(sys.argv) != 5:
        raise SystemExit("usage: apply_publication_request_hydrating.py REQUEST DATA STATE RESULT")
    raise SystemExit(main(*(Path(x) for x in sys.argv[1:])))
