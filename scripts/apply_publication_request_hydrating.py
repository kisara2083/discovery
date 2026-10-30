#!/usr/bin/env python3
"""Pre-hydrate verified saved assets, then run the unchanged publication applier."""
from __future__ import annotations
import json
import sys
from pathlib import Path

import apply_publication_request as publication
from public_saved_asset_hydration import hydrate


def main(reqp, datap, statep, resultp):
    req = json.loads(reqp.read_text(encoding="utf-8"))
    publication.exact(req, publication.REQUEST_KEYS, publication.REQUEST_KEYS, "request")
    if req.get("kind") != "DISCOVERY_PUBLICATION_REQUEST_V1" or req.get("schema_version") != 1:
        publication.fail("request_version")
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
