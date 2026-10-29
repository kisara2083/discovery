#!/usr/bin/env python3
"""Apply one inert DISCOVERY publication request to the validated public snapshot.

The request contains public-safe article data plus an opaque root derived only from
that public article. No Private repo revision/run/claim/source identity crosses the
Public boundary. Repository snapshot + publication-state are authoritative.
Lifecycle is a deterministic snapshot-time projection: delayed backlog publication
refreshes it from the request's as_of date instead of rejecting otherwise-valid work.
"""
from __future__ import annotations
import copy, datetime as dt, hashlib, json, re, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
REQUEST_KEYS={"kind","schema_version","publication_id","sequence","operation","article_id","ready_root","as_of","article"}
STATE_KEYS={"v","sequence","publication_id","article_id","ready_root","article_digest","dataset_digest"}
ARTICLE_REQUIRED={"id","slug","title","public_summary","category","status","lifecycle","published_date","updated_date","sources","spotify","images"}
ARTICLE_ALLOWED=ARTICLE_REQUIRED|{"public_detail","event_date","deadline_at","end_at","venue","city","price_terms","note","whats_new","media","world_card","display_selection"}
MEANINGFUL_UPDATE_FIELDS={"title","public_summary","public_detail","category","event_date","deadline_at","end_at","venue","city","price_terms","note","whats_new"}
SOURCE_KEYS={"url","name"}; WORLD_KEYS={"key","title","kicker","concept","meta","variant"}; DISPLAY_KEYS={"selector_version","card_primary","detail_primary","detail_secondary"}; REF_KEYS={"kind","key"}
IMAGE_ALLOWED={"url","source_page","relation","caption","mode","original_url","attribution","visual_provenance","framing","visual_role","quote_context"}; MEDIA_ALLOWED={"type","canonical_url","provider_id","title","evidence_url","source_url","image_url","visual_provenance"}
STATUSES={"NEW","UPDATE","REPEAT_RECOMMENDATION","HISTORICAL_CONTEXT"}; LIFECYCLES={"ACTIVE","ENDED"}; IMAGE_RELATIONS={"article_specific","official_entity","official_venue_or_organizer","reference_same_entity","related_official_reference"}; MEDIA_TYPES={"static_image","spotify_embed","steam_embed","youtube_embed","google_books_embed","x_embed"}; VARIANTS={"signal","grid","orbit","field"}; REF_KINDS={"image","media","world_card"}
PRIVATE_PATTERNS={"private_path":r"10_profile/|20_history/|30_output/discovery_v2/|ChatGPT_DB|\b[A-Za-z]:[\\/]|/Users/|/home/","email":r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}","phone":r"(?<!\d)(?:0\d{1,4}[- ]\d{1,4}[- ]\d{3,4}|\+81[- ]?\d[-\d ]{8,})(?!\d)","coordinates":r"[-+]?\d{2}\.\d{4,}\s*[,/]\s*[-+]?\d{2,3}\.\d{4,}","secret":r"gh[pousr]_[A-Za-z0-9]{16,}|github_pat_|sk-[A-Za-z0-9]{16,}|Bearer\s+\S+|-----BEGIN .*PRIVATE KEY","internal":r"recommendation_reason|profile_blob_sha|launcher_id|run_id|claim_id|connector_metadata|access_token|dynamic_subquestions|private_revision|source_root|identity_key","personal":r"あなた|ユーザー|自宅|通勤|購入履歴|所有機材|所有して|家族事情|家族構成|嗜好|好みに|お好み|遠征不要|両年齢|生活条件|個人履歴|勤務条件|勤務終了|現行Element|既存お気に入り|横断上位|探索でも|推薦理由|遠征候補|遠征価値|your (?:home|family|preference)|my (?:home|family)|our children"}
def fail(x): raise ValueError(x)
def exact(o,a,r=None,l="object"):
 if not isinstance(o,dict): fail(l+"_type")
 if set(o)-set(a): fail(l+"_unknown_fields")
 if r is not None and set(r)-set(o): fail(l+"_missing_fields")
def digest(v): return hashlib.sha256(json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(",",":")).encode()).hexdigest()
def meaningful(a): return {k:a.get(k) for k in MEANINGFUL_UPDATE_FIELDS}
def scan(v):
 text=unquote(json.dumps(v,ensure_ascii=False,sort_keys=True))
 for n,p in PRIVATE_PATTERNS.items():
  if re.search(p,text,re.I): fail("privacy_"+n)
def url(v):
 if not isinstance(v,str) or len(v)>2048: fail("url_type_or_size")
 p=urlparse(v)
 if p.scheme not in {"http","https"} or not p.hostname or p.username or p.password: fail("unsafe_url")
def date(v,l):
 if not isinstance(v,str): fail(l+"_type")
 try:
  if re.fullmatch(r"\d{4}-\d{2}-\d{2}",v): dt.date.fromisoformat(v); return
  dt.datetime.fromisoformat(v.replace("Z","+00:00")); return
 except ValueError: fail(l+"_date")
def as_jst(v):
 if re.fullmatch(r"\d{4}-\d{2}-\d{2}",v): return dt.date.fromisoformat(v)
 p=dt.datetime.fromisoformat(v.replace("Z","+00:00")); return (p.astimezone(dt.timezone(dt.timedelta(hours=9))) if p.tzinfo else p).date()
def lifecycle(a,today):
 ends=[as_jst(a[k]) for k in ("end_at","deadline_at") if a.get(k)]
 if not a.get("end_at") and a.get("event_date"): ends.append(as_jst(a["event_date"]))
 return "ENDED" if any(x<today for x in ends) else "ACTIVE"
def ref(v,l):
 if v is None:return
 exact(v,REF_KEYS,REF_KEYS,l)
 if v["kind"] not in REF_KINDS or not isinstance(v["key"],str) or not v["key"]: fail(l+"_value")
def validate_article(a,tax):
 exact(a,ARTICLE_ALLOWED,ARTICLE_REQUIRED,"article")
 if not re.fullmatch(r"a-[a-f0-9]{24}",str(a["id"])) or a["slug"]!=a["id"]: fail("article_identity")
 if not isinstance(a["title"],str) or not a["title"].strip() or not isinstance(a["public_summary"],str) or not a["public_summary"].strip(): fail("article_text")
 if a["category"] not in tax or a["status"] not in STATUSES or a["lifecycle"] not in LIFECYCLES: fail("article_enum")
 for k in ("published_date","updated_date"): date(a[k],k)
 for k in ("event_date","deadline_at","end_at"):
  if k in a: date(a[k],k)
 for k in ("sources","spotify"):
  if not isinstance(a[k],list): fail(k+"_type")
  for e in a[k]: exact(e,SOURCE_KEYS,SOURCE_KEYS,k); url(e["url"])
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
  key=a["world_card"]["key"]
  if (a["world_card"]["variant"] not in VARIANTS or not isinstance(key,str)
      or not key.startswith("world_card:") or not key[len("world_card:"):].strip()): fail("world_card")
 if "display_selection" in a:
  d=a["display_selection"]; exact(d,DISPLAY_KEYS,DISPLAY_KEYS,"display")
  if type(d["selector_version"]) is not int or d["selector_version"] not in {2,3,4,5,6,7}: fail("selector_version")
  ref(d["card_primary"],"card_primary"); ref(d["detail_primary"],"detail_primary")
  if not isinstance(d["detail_secondary"],list) or len(d["detail_secondary"])>4: fail("detail_secondary")
  for x in d["detail_secondary"]: ref(x,"detail_secondary_ref")
  for x in [d["card_primary"],d["detail_primary"],*d["detail_secondary"]]:
   if x and x["kind"]=="world_card" and ("world_card" not in a or x["key"]!=a["world_card"]["key"]): fail("world_card_binding")
  if d["selector_version"]==7:
   secondary=d["detail_secondary"]
   if any(x is None or x["kind"]=="world_card" for x in secondary): fail("secondary_world_or_null")
   keys=[x["key"] for x in secondary]
   if len(set(keys))!=len(keys) or (d["detail_primary"] and d["detail_primary"]["key"] in keys): fail("secondary_duplicate")
 scan(a)
def load_state(p):
 if not p.exists():return None
 v=json.loads(p.read_text()); exact(v,STATE_KEYS,STATE_KEYS,"state")
 if v["v"]!=1 or type(v["sequence"]) is not int or v["sequence"]<1: fail("state_schema")
 return v
def main(reqp,datap,statep,resultp):
 if reqp.stat().st_size>32768: fail("request_too_large")
 req=json.loads(reqp.read_text()); exact(req,REQUEST_KEYS,REQUEST_KEYS,"request")
 if req["kind"]!="DISCOVERY_PUBLICATION_REQUEST_V1" or req["schema_version"]!=1: fail("request_version")
 if type(req["sequence"]) is not int or not 1<=req["sequence"]<=1000000 or not re.fullmatch(r"[0-9a-f]{40}",str(req["ready_root"])): fail("request_binding")
 if req["publication_id"]!=f"pub-v1-{req['sequence']:08d}-{req['ready_root']}": fail("publication_id_binding")
 if req["operation"] not in {"NEW","UPDATE"} or req["article_id"]!=req["article"].get("id"): fail("request_semantics")
 date(req["as_of"],"as_of"); today=dt.date.fromisoformat(req["as_of"]); scan({k:v for k,v in req.items() if k!="article"})
 data=json.loads(datap.read_text())
 if data.get("schema_version")!="1" or data.get("site_name")!="DISCOVERY" or not isinstance(data.get("articles"),list): fail("public_dataset_shape")
 tax={g["id"] for g in data.get("taxonomy",[]) if isinstance(g,dict) and isinstance(g.get("id"),str)}
 validate_article(req["article"],tax); article=copy.deepcopy(req["article"]); article["lifecycle"]=lifecycle(article,today); state=load_state(statep); seq=state["sequence"] if state else 0
 if req["sequence"]==seq:
  if not state or any(state[k]!=req[k] for k in ("publication_id","article_id","ready_root")): fail("sequence_conflict")
  encoded=json.dumps(data,ensure_ascii=False,indent=2)+"\n"
  if hashlib.sha256(encoded.encode()).hexdigest()!=state["dataset_digest"]: fail("duplicate_dataset_drift")
  found=[x for x in data["articles"] if x.get("id")==article["id"]]
  if len(found)!=1 or digest(found[0])!=state["article_digest"]: fail("duplicate_article_drift")
  out={"v":1,**{k:state[k] for k in STATE_KEYS if k!="v"},"snapshot_changed":False,"receipt_changed":False,"changed":False}; resultp.write_text(json.dumps(out,sort_keys=True)+"\n"); print(json.dumps(out,sort_keys=True)); return 0
 if req["sequence"]!=seq+1: fail("sequence_gap_or_stale")
 pos=[i for i,x in enumerate(data["articles"]) if x.get("id")==article["id"]]
 if len(pos)>1: fail("duplicate_existing_identity")
 existing=data["articles"][pos[0]] if pos else None
 if req["operation"]=="NEW" and existing is not None and digest(existing)!=digest(article): fail("new_conflicts_existing")
 if req["operation"]=="UPDATE" and existing is None: fail("update_missing_existing")
 if req["operation"]=="UPDATE" and article["published_date"]!=existing["published_date"]: fail("update_published_date_drift")
 if existing is None:
  article["updated_date"]=req["as_of"]
 elif req["operation"]=="UPDATE":
  article["updated_date"]=existing["updated_date"] if meaningful(article)==meaningful(existing) else req["as_of"]
 if existing is None:data["articles"].append(article)
 elif digest(existing)!=digest(article):data["articles"][pos[0]]=article
 for x in data["articles"]:x["lifecycle"]=lifecycle(x,today)
 data["articles"].sort(key=lambda x:str(x.get("updated_date","")),reverse=True); active=[x for x in data["articles"] if x.get("lifecycle")!="ENDED"]; data["as_of"]=req["as_of"]; data["todays_pick"]=active[0]["id"] if active else None; scan(data)
 before=datap.read_text(); encoded=json.dumps(data,ensure_ascii=False,indent=2)+"\n"; snapshot_changed=encoded!=before
 if snapshot_changed:datap.write_text(encoded)
 receipt={"v":1,"sequence":req["sequence"],"publication_id":req["publication_id"],"article_id":article["id"],"ready_root":req["ready_root"],"article_digest":digest(article),"dataset_digest":hashlib.sha256(encoded.encode()).hexdigest()}; text=json.dumps(receipt,sort_keys=True)+"\n"; prior=json.dumps(state,sort_keys=True)+"\n" if state else None; receipt_changed=text!=prior
 if receipt_changed:statep.parent.mkdir(parents=True,exist_ok=True); statep.write_text(text)
 out={**receipt,"snapshot_changed":snapshot_changed,"receipt_changed":receipt_changed,"changed":snapshot_changed or receipt_changed}; resultp.write_text(json.dumps(out,sort_keys=True)+"\n"); print(json.dumps(out,sort_keys=True)); return 0
if __name__=="__main__":
 if len(sys.argv)!=5: raise SystemExit("usage: apply_publication_request.py REQUEST DATA STATE RESULT")
 try: raise SystemExit(main(*(Path(x) for x in sys.argv[1:])))
 except Exception as e: print(json.dumps({"v":1,"error":type(e).__name__+":"+str(e)},sort_keys=True),file=sys.stderr); raise
