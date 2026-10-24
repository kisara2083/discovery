#!/usr/bin/env python3
"""Apply one inert DISCOVERY publication request to the validated public snapshot.

The Git repository is authoritative. A successful new sequence updates
`data/publication-state.json` in the same commit as any snapshot change. Replaying
that exact sequence is NO_CHANGE; stale/gapped/conflicting requests fail closed.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

REQUEST_KEYS={"kind","schema_version","publication_id","sequence","operation","article_id","ready_root","private_revision","as_of","article"}
STATE_KEYS={"v","sequence","publication_id","article_id","ready_root","private_revision","article_digest","dataset_digest"}
ARTICLE_REQUIRED={"id","slug","title","public_summary","category","status","lifecycle","published_date","updated_date","sources","spotify","images"}
ARTICLE_ALLOWED=ARTICLE_REQUIRED|{"public_detail","event_date","deadline_at","end_at","venue","city","price_terms","note","whats_new","media","world_card","display_selection"}
SOURCE_KEYS={"url","name"}; WORLD_KEYS={"key","title","kicker","concept","meta","variant"}; DISPLAY_KEYS={"selector_version","card_primary","detail_primary","detail_secondary"}; REF_KEYS={"kind","key"}
IMAGE_ALLOWED={"url","source_page","relation","caption","mode","original_url","attribution","visual_provenance","framing","visual_role","quote_context"}
MEDIA_ALLOWED={"type","canonical_url","provider_id","title","evidence_url","source_url","image_url","visual_provenance"}
STATUSES={"NEW","UPDATE","REPEAT_RECOMMENDATION","HISTORICAL_CONTEXT"}; LIFECYCLES={"ACTIVE","ENDED"}
IMAGE_RELATIONS={"article_specific","official_entity","official_venue_or_organizer","reference_same_entity","related_official_reference"}
MEDIA_TYPES={"static_image","spotify_embed","steam_embed","youtube_embed","google_books_embed","x_embed"}; VARIANTS={"signal","grid","orbit","field"}; REF_KINDS={"image","media","world_card"}
PRIVATE_PATTERNS={
 "private_path":r"10_profile/|20_history/|30_output/discovery_v2/|ChatGPT_DB|\b[A-Za-z]:[\\/]|/Users/|/home/",
 "email":r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}","phone":r"(?<!\d)(?:0\d{1,4}[- ]\d{1,4}[- ]\d{3,4}|\+81[- ]?\d[-\d ]{8,})(?!\d)",
 "coordinates":r"[-+]?\d{2}\.\d{4,}\s*[,/]\s*[-+]?\d{2,3}\.\d{4,}","secret":r"gh[pousr]_[A-Za-z0-9]{16,}|github_pat_|sk-[A-Za-z0-9]{16,}|Bearer\s+\S+|-----BEGIN .*PRIVATE KEY",
 "internal":r"recommendation_reason|profile_blob_sha|launcher_id|run_id|claim_id|connector_metadata|access_token|dynamic_subquestions",
 "personal":r"あなた|ユーザー|自宅|通勤|購入履歴|所有機材|所有して|家族事情|家族構成|嗜好|好みに|お好み|遠征不要|両年齢|生活条件|個人履歴|勤務条件|勤務終了|現行Element|既存お気に入り|横断上位|探索でも|推薦理由|遠征候補|遠征価値|your (?:home|family|preference)|my (?:home|family)|our children",
}

def fail(reason): raise ValueError(reason)
def exact(obj,allowed,required=None,label="object"):
 if not isinstance(obj,dict): fail(label+"_type")
 if set(obj)-set(allowed): fail(label+"_unknown_fields")
 if required is not None and set(required)-set(obj): fail(label+"_missing_fields")
def digest(value): return hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(",",":")).encode()).hexdigest()
def scan(value):
 text=unquote(json.dumps(value,ensure_ascii=False,sort_keys=True))
 for name,pat in PRIVATE_PATTERNS.items():
  if re.search(pat,text,re.I): fail("privacy_"+name)
def url(value):
 if not isinstance(value,str) or len(value)>2048: fail("url_type_or_size")
 p=urlparse(value)
 if p.scheme not in {"http","https"} or not p.hostname or p.username or p.password: fail("unsafe_url")
def date(value,label):
 if not isinstance(value,str): fail(label+"_type")
 try:
  if re.fullmatch(r"\d{4}-\d{2}-\d{2}",value): dt.date.fromisoformat(value); return
  dt.datetime.fromisoformat(value.replace("Z","+00:00")); return
 except ValueError: fail(label+"_date")
def as_jst(value):
 if re.fullmatch(r"\d{4}-\d{2}-\d{2}",value): return dt.date.fromisoformat(value)
 p=dt.datetime.fromisoformat(value.replace("Z","+00:00")); return (p.astimezone(dt.timezone(dt.timedelta(hours=9))) if p.tzinfo else p).date()
def expected_lifecycle(article,today):
 ends=[as_jst(article[k]) for k in ("end_at","deadline_at") if article.get(k)]
 if not article.get("end_at") and article.get("event_date"): ends.append(as_jst(article["event_date"]))
 return "ENDED" if any(day<today for day in ends) else "ACTIVE"
def ref(value,label):
 if value is None:return
 exact(value,REF_KEYS,REF_KEYS,label)
 if value["kind"] not in REF_KINDS or not isinstance(value["key"],str) or not value["key"]: fail(label+"_value")
def validate_article(a,taxonomy,today):
 exact(a,ARTICLE_ALLOWED,ARTICLE_REQUIRED,"article")
 if not re.fullmatch(r"a-[a-f0-9]{24}",str(a["id"])) or a["slug"]!=a["id"]: fail("article_identity")
 if not isinstance(a["title"],str) or not a["title"].strip() or not isinstance(a["public_summary"],str) or not a["public_summary"].strip(): fail("article_text")
 if a["category"] not in taxonomy or a["status"] not in STATUSES or a["lifecycle"] not in LIFECYCLES: fail("article_enum")
 for k in ("published_date","updated_date"): date(a[k],k)
 for k in ("event_date","deadline_at","end_at"):
  if k in a: date(a[k],k)
 if a["lifecycle"]!=expected_lifecycle(a,today): fail("article_lifecycle_stale")
 for key in ("sources","spotify"):
  if not isinstance(a[key],list): fail(key+"_type")
  for e in a[key]: exact(e,SOURCE_KEYS,SOURCE_KEYS,key); url(e["url"])
 if not a["sources"]: fail("sources_empty")
 if not isinstance(a["images"],list): fail("images_type")
 for i in a["images"]:
  exact(i,IMAGE_ALLOWED,{"url","source_page","relation","caption","mode"},"image"); url(i["source_page"])
  if i["relation"] not in IMAGE_RELATIONS or i["mode"] not in {"saved","external"}: fail("image_enum")
  if i["mode"]=="external": url(i["url"])
  elif not re.fullmatch(r"assets/images/[a-f0-9]{64}\.(jpg|png|gif|webp)",str(i["url"])): fail("saved_image_path")
  if "original_url" in i:url(i["original_url"])
 for m in a.get("media",[]):
  exact(m,MEDIA_ALLOWED,{"type"},"media")
  if m["type"] not in MEDIA_TYPES: fail("media_type")
  for k in ("canonical_url","evidence_url","source_url","image_url"):
   if k in m:url(m[k])
 if "world_card" in a:
  exact(a["world_card"],WORLD_KEYS,WORLD_KEYS,"world_card")
  if a["world_card"]["variant"] not in VARIANTS or a["world_card"]["key"]!="world_card:"+a["id"]: fail("world_card")
 if "display_selection" in a:
  d=a["display_selection"]; exact(d,DISPLAY_KEYS,DISPLAY_KEYS,"display")
  if d["selector_version"] not in {2,3,4,5,6}: fail("selector_version")
  ref(d["card_primary"],"card_primary"); ref(d["detail_primary"],"detail_primary")
  if not isinstance(d["detail_secondary"],list) or len(d["detail_secondary"])>4: fail("detail_secondary")
  for r in d["detail_secondary"]: ref(r,"detail_secondary_ref")
 scan(a)
def load_state(path):
 if not path.exists(): return None
 value=json.loads(path.read_text(encoding="utf-8")); exact(value,STATE_KEYS,STATE_KEYS,"state")
 if value["v"]!=1 or type(value["sequence"]) is not int or value["sequence"]<1: fail("state_schema")
 return value

def main(request_path,data_path,state_path,result_path):
 if request_path.stat().st_size>32768: fail("request_too_large")
 req=json.loads(request_path.read_text(encoding="utf-8")); exact(req,REQUEST_KEYS,REQUEST_KEYS,"request")
 if req["kind"]!="DISCOVERY_PUBLICATION_REQUEST_V1" or req["schema_version"]!=1: fail("request_version")
 if type(req["sequence"]) is not int or not 1<=req["sequence"]<=1000000: fail("sequence")
 if not re.fullmatch(r"[0-9a-f]{40}",str(req["ready_root"])) or not re.fullmatch(r"[0-9a-f]{40}",str(req["private_revision"])): fail("private_binding")
 expected_id=f"pub-v1-{req['sequence']:08d}-{req['ready_root']}"
 if req["publication_id"]!=expected_id: fail("publication_id_binding")
 if req["operation"] not in {"NEW","UPDATE"}: fail("operation")
 if req["article_id"]!=req["article"].get("id"): fail("request_article_identity")
 date(req["as_of"],"as_of"); today=dt.date.fromisoformat(req["as_of"])
 data=json.loads(data_path.read_text(encoding="utf-8"))
 if data.get("schema_version")!="1" or data.get("site_name")!="DISCOVERY" or not isinstance(data.get("articles"),list): fail("public_dataset_shape")
 taxonomy={g["id"] for g in data.get("taxonomy",[]) if isinstance(g,dict) and isinstance(g.get("id"),str)}
 article=req["article"]; validate_article(article,taxonomy,today)
 state=load_state(state_path)
 current_seq=state["sequence"] if state else 0
 if req["sequence"]==current_seq:
  if not state or any(state[k]!=req[k] for k in ("publication_id","article_id","ready_root","private_revision")): fail("sequence_conflict")
  encoded=json.dumps(data,ensure_ascii=False,indent=2)+"\n"
  if hashlib.sha256(encoded.encode()).hexdigest()!=state["dataset_digest"]: fail("duplicate_dataset_drift")
  found=[x for x in data["articles"] if x.get("id")==article["id"]]
  if len(found)!=1 or digest(found[0])!=state["article_digest"]: fail("duplicate_article_drift")
  result={"v":1,**{k:state[k] for k in STATE_KEYS if k!="v"},"snapshot_changed":False,"receipt_changed":False,"changed":False}
  result_path.write_text(json.dumps(result,sort_keys=True)+"\n",encoding="utf-8"); print(json.dumps(result,sort_keys=True)); return 0
 if req["sequence"]!=current_seq+1: fail("sequence_gap_or_stale")
 positions=[i for i,x in enumerate(data["articles"]) if x.get("id")==article["id"]]
 if len(positions)>1: fail("duplicate_existing_identity")
 existing=data["articles"][positions[0]] if positions else None
 if req["operation"]=="NEW" and existing is not None and digest(existing)!=digest(article): fail("new_conflicts_existing")
 if req["operation"]=="UPDATE" and existing is None: fail("update_missing_existing")
 if req["operation"]=="UPDATE" and article["published_date"]!=existing["published_date"]: fail("update_published_date_drift")
 if existing is None:data["articles"].append(article)
 elif digest(existing)!=digest(article):data["articles"][positions[0]]=article
 for item in data["articles"]: item["lifecycle"]=expected_lifecycle(item,today)
 data["articles"].sort(key=lambda x:str(x.get("updated_date","")),reverse=True)
 active=[x for x in data["articles"] if x.get("lifecycle")!="ENDED"]; data["as_of"]=req["as_of"]; data["todays_pick"]=active[0]["id"] if active else None; scan(data)
 before=data_path.read_text(encoding="utf-8"); encoded=json.dumps(data,ensure_ascii=False,indent=2)+"\n"; snapshot_changed=encoded!=before
 if snapshot_changed:data_path.write_text(encoded,encoding="utf-8")
 receipt={"v":1,"sequence":req["sequence"],"publication_id":req["publication_id"],"article_id":article["id"],"ready_root":req["ready_root"],"private_revision":req["private_revision"],"article_digest":digest(article),"dataset_digest":hashlib.sha256(encoded.encode()).hexdigest()}
 prior=json.dumps(state,sort_keys=True)+"\n" if state else None; receipt_text=json.dumps(receipt,sort_keys=True)+"\n"; receipt_changed=receipt_text!=prior
 if receipt_changed: state_path.parent.mkdir(parents=True,exist_ok=True); state_path.write_text(receipt_text,encoding="utf-8")
 result={**receipt,"snapshot_changed":snapshot_changed,"receipt_changed":receipt_changed,"changed":snapshot_changed or receipt_changed}
 result_path.write_text(json.dumps(result,sort_keys=True)+"\n",encoding="utf-8"); print(json.dumps(result,sort_keys=True)); return 0

if __name__=="__main__":
 if len(sys.argv)!=5: raise SystemExit("usage: apply_publication_request.py REQUEST DATA STATE RESULT")
 try: raise SystemExit(main(*(Path(x) for x in sys.argv[1:])))
 except Exception as exc:
  print(json.dumps({"v":1,"error":type(exc).__name__+":"+str(exc)},sort_keys=True),file=sys.stderr); raise
