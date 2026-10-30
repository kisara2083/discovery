#!/usr/bin/env python3
"""Pre-hydrate verified saved assets, then run the unchanged Visual maintenance applier."""
from __future__ import annotations
import copy
import json
import sys
from pathlib import Path

import apply_publication_request as publication
import apply_visual_maintenance_request as maintenance
from public_saved_asset_hydration import hydrate


def main(reqp, datap, statep, resultp):
    req = json.loads(reqp.read_text(encoding="utf-8"))
    maintenance.validate_request(req)
    data = json.loads(datap.read_text(encoding="utf-8"))
    positions = [i for i, a in enumerate(data.get("articles", []))
                 if isinstance(a, dict) and a.get("id") == req["article_id"]]
    if len(positions) != 1:
        maintenance.fail("target_article_count")
    current = data["articles"][positions[0]]
    replacement = copy.deepcopy(current)
    for key in maintenance.VISUAL_KEYS:
        replacement[key] = copy.deepcopy(req["visual"][key])
    tax = {g["id"] for g in data.get("taxonomy", [])
           if isinstance(g, dict) and isinstance(g.get("id"), str)}
    publication.validate_article(replacement, tax)
    hydrate(replacement, datap.parent.parent)
    return maintenance.main(reqp, datap, statep, resultp)


if __name__ == "__main__":
    if len(sys.argv) != 5:
        raise SystemExit("usage: apply_visual_maintenance_request_hydrating.py REQUEST DATA STATE RESULT")
    raise SystemExit(main(*(Path(x) for x in sys.argv[1:])))
