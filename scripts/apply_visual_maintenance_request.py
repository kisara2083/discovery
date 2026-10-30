#!/usr/bin/env python3
"""Apply one Visual-only maintenance request to the public DISCOVERY snapshot.

This lane is intentionally independent of normal publication sequence/READY
semantics. It mutates only article Visual fields and a dedicated maintenance
receipt. The request is bound to the exact current full Public article digest;
any factual/lifecycle/source drift fails closed before a write.
"""
from __future__ import annotations

import copy
import hashlib
import json
import re
import sys
from pathlib import Path

import apply_publication_request as publication

REQUEST_KEYS={"kind","schema_version","maintenance_id","article_id","expected_article_digest","visual"}
VISUAL_KEYS={"images","media","world_card","display_selection"}
WORLD_IMMUTABLE_KEYS={"key","title","kicker","concept","meta"}
PUBLIC_QUOTE_KEYS={"quote_version","relation","target","source_name","source_page","display_mode","role_label","context_sentence"}
PUBLIC_PROVENANCE_KEYS={"relation","official_source","source_revalidated","article_match","entity_match","authority_class"}
STATE_KEYS={"v","maintenance_id","article_id","expected_article_digest","result_article_digest","visual_digest","dataset_digest"}

def fail(x):
    raise ValueError(x)

def exact(o,allowed,required=None,label="object"):
    if not isinstance(o,dict): fail(label+"_type")
    if set(o)-set(allowed): fail(label+"_unknown_fields")
    if required is not None and set(required)-set(o): fail(label+"_missing_fields")

def digest(v):
    return hashlib.sha256(json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(",",":")).encode()).hexdigest()

def dataset_text(data):
    return json.dumps(data,ensure_ascii=False,indent=2)+"\n"

def bound_maintenance_id(article_id,expected_article_digest,visual):
    binding={"article_id":article_id,"expected_article_digest":expected_article_digest,"visual":visual}
    return "vm-v1-"+digest(binding)[:40]

def load_state(path):
    if not path.exists(): return None
    value=json.loads(path.read_text(encoding="utf-8"))
    exact(value,STATE_KEYS,STATE_KEYS,"state")
    if value["v"]!=1: fail("state_version")
    return value

def validate_request(req):
    exact(req,REQUEST_KEYS,REQUEST_KEYS,"request")
    if req["kind"]!="DISCOVERY_VISUAL_MAINTENANCE_REQUEST_V1" or req["schema_version"]!=1:
        fail("request_version")
    if not re.fullmatch(r"a-[a-f0-9]{24}",str(req["article_id"])):
        fail("article_id")
    if not re.fullmatch(r"[a-f0-9]{64}",str(req["expected_article_digest"])):
        fail("expected_article_digest")
    exact(req["visual"],VISUAL_KEYS,VISUAL_KEYS,"visual")
    if not isinstance(req["visual"]["images"],list) or not isinstance(req["visual"]["media"],list):
        fail("visual_list_type")
    if not isinstance(req["visual"]["world_card"],dict) or not isinstance(req["visual"]["display_selection"],dict):
        fail("visual_object_type")
    if req["visual"]["display_selection"].get("selector_version")!=7:
        fail("visual_selector_version")
    expected_id=bound_maintenance_id(req["article_id"],req["expected_article_digest"],req["visual"])
    if req["maintenance_id"]!=expected_id:
        fail("maintenance_id_binding")

def validate_public_provenance(value,label):
    exact(value,PUBLIC_PROVENANCE_KEYS,PUBLIC_PROVENANCE_KEYS,label)
    if not isinstance(value["relation"],str) or not value["relation"] or not isinstance(value["authority_class"],str) or not value["authority_class"]:
        fail(label+"_value")
    for key in ("official_source","source_revalidated","article_match","entity_match"):
        if type(value[key]) is not bool: fail(label+"_value")

def validate_public_quote(value,image):
    exact(value,PUBLIC_QUOTE_KEYS,PUBLIC_QUOTE_KEYS,"public_quote")
    if value["quote_version"]!=2: fail("public_quote_version")
    for key in ("relation","target","source_name","source_page","role_label","context_sentence"):
        if not isinstance(value[key],str) or not value[key].strip(): fail("public_quote_value")
    publication.url(value["source_page"])
    if value["display_mode"] not in {"external","saved"} or value["display_mode"]!=image.get("mode"):
        fail("public_quote_display_mode")
    if value["source_page"]!=image.get("source_page"):
        fail("public_quote_source_binding")

def validate_visual_payload(current,replacement,repo_root):
    current_world=current.get("world_card")
    replacement_world=replacement.get("world_card")
    if not isinstance(current_world,dict) or not isinstance(replacement_world,dict):
        fail("world_card_current_missing")
    # world_card is a Visual surface, but its factual/title text is not a
    # maintenance input. Only the presentation variant may change here.
    if any(replacement_world.get(k)!=current_world.get(k) for k in WORLD_IMMUTABLE_KEYS):
        fail("world_card_nonvisual_drift")

    image_keys={"image:"+str(i.get("url","")) for i in replacement.get("images",[])}
    media_keys={"media:"+str(m.get("canonical_url","")) for m in replacement.get("media",[])}
    if len(image_keys)!=len(replacement.get("images",[])) or len(media_keys)!=len(replacement.get("media",[])):
        fail("visual_candidate_duplicate")
    candidates={"image":image_keys,"media":media_keys,"world_card":{replacement_world["key"]}}
    selection=replacement["display_selection"]
    refs=[selection.get("card_primary"),selection.get("detail_primary"),*selection.get("detail_secondary",[])]
    for ref in refs:
        if ref is None: continue
        if ref["key"] not in candidates.get(ref["kind"],set()):
            fail("display_ref_missing_candidate")

    # Private review gates/history are not Public payload. Accept only the small
    # display context and provenance projection emitted by the reviewed preview.
    for image in replacement.get("images",[]):
        if image.get("visual_provenance") is not None:
            validate_public_provenance(image["visual_provenance"],"public_image_provenance")
        if image.get("quote_context") is not None:
            validate_public_quote(image["quote_context"],image)
    for media in replacement.get("media",[]):
        if media.get("visual_provenance") is not None:
            validate_public_provenance(media["visual_provenance"],"public_media_provenance")

    # Binary transport is a separate migration lane. A saved image referenced by
    # maintenance must already exist in the checked-out Public repository and its
    # bytes must match the content-addressed filename.
    for image in replacement.get("images",[]):
        if image.get("mode")!="saved": continue
        asset=repo_root/image["url"]
        if not asset.is_file(): fail("saved_image_missing")
        if hashlib.sha256(asset.read_bytes()).hexdigest()!=asset.stem:
            fail("saved_image_digest")

def main(reqp,datap,statep,resultp):
    if reqp.stat().st_size>65536: fail("request_too_large")
    req=json.loads(reqp.read_text(encoding="utf-8"))
    validate_request(req)

    data=json.loads(datap.read_text(encoding="utf-8"))
    if data.get("schema_version")!="1" or data.get("site_name")!="DISCOVERY" or not isinstance(data.get("articles"),list):
        fail("public_dataset_shape")
    positions=[i for i,a in enumerate(data["articles"]) if isinstance(a,dict) and a.get("id")==req["article_id"]]
    if len(positions)!=1: fail("target_article_count")
    pos=positions[0]
    current=data["articles"][pos]
    current_digest=digest(current)
    encoded_before=dataset_text(data)
    state=load_state(statep)
    vdig=digest(req["visual"])

    # Exact retry of the latest successful maintenance request is idempotent.
    if state and state["maintenance_id"]==req["maintenance_id"]:
        if state["article_id"]!=req["article_id"] or state["expected_article_digest"]!=req["expected_article_digest"] or state["visual_digest"]!=vdig:
            fail("duplicate_binding_drift")
        if current_digest!=state["result_article_digest"] or hashlib.sha256(encoded_before.encode()).hexdigest()!=state["dataset_digest"]:
            fail("duplicate_dataset_drift")
        out={**state,"changed":False,"snapshot_changed":False,"receipt_changed":False}
        resultp.write_text(json.dumps(out,sort_keys=True)+"\n",encoding="utf-8")
        print(json.dumps(out,sort_keys=True))
        return 0

    # The target article is the lock. Any intervening normal update to it rejects
    # this request with zero writes; changes to other articles are allowed.
    if current_digest!=req["expected_article_digest"]:
        fail("article_digest_mismatch")

    replacement=copy.deepcopy(current)
    immutable_before={k:copy.deepcopy(v) for k,v in current.items() if k not in VISUAL_KEYS}
    for k in VISUAL_KEYS:
        replacement[k]=copy.deepcopy(req["visual"][k])
    immutable_after={k:copy.deepcopy(v) for k,v in replacement.items() if k not in VISUAL_KEYS}
    if immutable_after!=immutable_before:
        fail("non_visual_field_changed")

    taxonomy={g["id"] for g in data.get("taxonomy",[]) if isinstance(g,dict) and isinstance(g.get("id"),str)}
    publication.validate_article(replacement,taxonomy)
    repo_root=datap.parent.parent if datap.parent.name=="data" else Path.cwd()
    validate_visual_payload(current,replacement,repo_root)
    result_article_digest=digest(replacement)

    if result_article_digest!=current_digest:
        data["articles"][pos]=replacement
    encoded=dataset_text(data)
    snapshot_changed=encoded!=encoded_before
    if snapshot_changed:
        datap.write_text(encoded,encoding="utf-8")

    receipt={
        "v":1,
        "maintenance_id":req["maintenance_id"],
        "article_id":req["article_id"],
        "expected_article_digest":req["expected_article_digest"],
        "result_article_digest":result_article_digest,
        "visual_digest":vdig,
        "dataset_digest":hashlib.sha256(encoded.encode()).hexdigest(),
    }
    prior=json.dumps(state,sort_keys=True)+"\n" if state else None
    receipt_text=json.dumps(receipt,sort_keys=True)+"\n"
    receipt_changed=receipt_text!=prior
    if receipt_changed:
        statep.parent.mkdir(parents=True,exist_ok=True)
        statep.write_text(receipt_text,encoding="utf-8")

    out={**receipt,"changed":snapshot_changed or receipt_changed,"snapshot_changed":snapshot_changed,"receipt_changed":receipt_changed}
    resultp.write_text(json.dumps(out,sort_keys=True)+"\n",encoding="utf-8")
    print(json.dumps(out,sort_keys=True))
    return 0

if __name__=="__main__":
    if len(sys.argv)!=5:
        raise SystemExit("usage: apply_visual_maintenance_request.py REQUEST DATA STATE RESULT")
    try:
        raise SystemExit(main(*(Path(x) for x in sys.argv[1:])))
    except Exception as e:
        print(json.dumps({"v":1,"error":type(e).__name__+":"+str(e)},sort_keys=True),file=sys.stderr)
        raise
