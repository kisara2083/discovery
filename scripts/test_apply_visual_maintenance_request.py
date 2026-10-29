import copy, hashlib, json, subprocess, sys, tempfile, unittest
from pathlib import Path

SCRIPTS=Path(__file__).resolve().parent
if str(SCRIPTS) not in sys.path:
 sys.path.insert(0,str(SCRIPTS))
import apply_visual_maintenance_request as vm

SCRIPT=SCRIPTS/'apply_visual_maintenance_request.py'
NORMAL=SCRIPTS/'apply_publication_request.py'

def digest(v):
 return hashlib.sha256(json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def article(article_id='a-111111111111111111111111',title='Example',summary='Summary'):
 return {'id':article_id,'slug':article_id,'title':title,'public_summary':summary,'category':'games','status':'NEW','lifecycle':'ACTIVE','published_date':'2026-10-24','updated_date':'2026-10-24','sources':[{'url':'https://example.com/item','name':'Official source'}],'spotify':[],'images':[],'media':[],'world_card':{'key':'world_card:'+article_id,'title':title,'kicker':'GAME / DISCOVERY','concept':summary,'meta':'','variant':'field'},'display_selection':{'selector_version':7,'card_primary':{'kind':'world_card','key':'world_card:'+article_id},'detail_primary':{'kind':'world_card','key':'world_card:'+article_id},'detail_secondary':[]}}

def visual(a,variant='grid'):
 v={k:copy.deepcopy(a[k]) for k in vm.VISUAL_KEYS}
 v['world_card']['variant']=variant
 return v

def request(a,v=None):
 v=visual(a) if v is None else copy.deepcopy(v)
 expected=digest(a)
 return {'kind':'DISCOVERY_VISUAL_MAINTENANCE_REQUEST_V1','schema_version':1,'maintenance_id':vm.bound_maintenance_id(a['id'],expected,v),'article_id':a['id'],'expected_article_digest':expected,'visual':v}

def dataset(items,as_of='2026-10-29'):
 return {'schema_version':'1','site_name':'DISCOVERY','as_of':as_of,'taxonomy':[{'id':'games','label':'ゲーム'}],'todays_pick':items[0]['id'] if items else None,'articles':copy.deepcopy(items)}

class VisualMaintenanceTests(unittest.TestCase):
 def run_case(self,data,req,state=None,publication_state='sentinel-publication-state\n',expect_ok=True):
  with tempfile.TemporaryDirectory() as td:
   p=Path(td); dp=p/'public-data.json'; rp=p/'request.json'; sp=p/'visual-maintenance-state.json'; op=p/'result.json'; pp=p/'publication-state.json'
   dp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); rp.write_text(json.dumps(req,ensure_ascii=False),encoding='utf-8'); pp.write_text(publication_state,encoding='utf-8')
   if state is not None: sp.write_text(json.dumps(state,sort_keys=True)+'\n',encoding='utf-8')
   before_pub=pp.read_bytes(); before_data=dp.read_bytes(); before_state=sp.read_bytes() if sp.exists() else None
   proc=subprocess.run(['python',str(SCRIPT),str(rp),str(dp),str(sp),str(op)],text=True,capture_output=True)
   if not expect_ok:
    self.assertNotEqual(proc.returncode,0); self.assertEqual(before_pub,pp.read_bytes()); self.assertEqual(before_data,dp.read_bytes()); self.assertEqual(before_state,sp.read_bytes() if sp.exists() else None); return proc
   self.assertEqual(proc.returncode,0,proc.stderr); self.assertEqual(before_pub,pp.read_bytes())
   return json.loads(dp.read_text()),json.loads(sp.read_text()),json.loads(op.read_text()),pp.read_text()

 def test_visual_only_mutation_preserves_all_non_visual_fields_and_publication_state(self):
  a=article(); req=request(a); before={k:copy.deepcopy(v) for k,v in a.items() if k not in vm.VISUAL_KEYS}; d,s,r,pub=self.run_case(dataset([a]),req)
  stored=d['articles'][0]; after={k:copy.deepcopy(v) for k,v in stored.items() if k not in vm.VISUAL_KEYS}
  self.assertEqual(before,after); self.assertEqual('sentinel-publication-state\n',pub); self.assertEqual('grid',stored['world_card']['variant']); self.assertEqual(a['world_card']['concept'],stored['world_card']['concept']); self.assertTrue(r['snapshot_changed']); self.assertTrue(r['receipt_changed']); self.assertEqual(req['maintenance_id'],s['maintenance_id'])

 def test_world_card_text_drift_is_rejected_zero_write(self):
  a=article(); v=visual(a); v['world_card']['concept']='Changed through Visual lane'; req=request(a,v)
  p=self.run_case(dataset([a]),req,expect_ok=False); self.assertIn('world_card_nonvisual_drift',p.stderr)

 def test_dangling_display_ref_is_rejected_zero_write(self):
  a=article(); v=visual(a); v['display_selection']['card_primary']={'kind':'image','key':'image:https://example.com/missing.jpg'}; req=request(a,v)
  p=self.run_case(dataset([a]),req,expect_ok=False); self.assertIn('display_ref_missing_candidate',p.stderr)

 def test_missing_saved_asset_is_rejected_zero_write(self):
  a=article(); v=visual(a); h='0'*64; v['images']=[{'url':'assets/images/'+h+'.jpg','source_page':'https://example.com/source','relation':'article_specific','caption':'Exact image','mode':'saved'}]; req=request(a,v)
  p=self.run_case(dataset([a]),req,expect_ok=False); self.assertIn('saved_image_missing',p.stderr)

 def test_same_target_normal_update_after_request_fails_zero_write(self):
  a=article(); req=request(a); changed=copy.deepcopy(a); changed['public_summary']='Normal publication changed facts'
  p=self.run_case(dataset([changed]),req,expect_ok=False); self.assertIn('article_digest_mismatch',p.stderr)

 def test_other_article_change_does_not_invalidate_target_digest(self):
  target=article(); other=article('a-222222222222222222222222','Other','Before'); req=request(target); data=dataset([target,other]); data['articles'][1]['public_summary']='After'; original_as_of=data['as_of']; original_pick=data['todays_pick']
  d,_,_,_=self.run_case(data,req); self.assertEqual('After',d['articles'][1]['public_summary']); self.assertEqual(original_as_of,d['as_of']); self.assertEqual(original_pick,d['todays_pick'])

 def test_exact_duplicate_is_idempotent(self):
  a=article(); req=request(a); d1,s1,r1,_=self.run_case(dataset([a]),req); self.assertTrue(r1['changed'])
  d2,s2,r2,_=self.run_case(d1,req,s1); self.assertEqual(d1,d2); self.assertEqual(s1,s2); self.assertFalse(r2['changed'])

 def test_selector_v6_maintenance_is_rejected(self):
  a=article(); v=visual(a); v['display_selection']['selector_version']=6; req=request(a,v); p=self.run_case(dataset([a]),req,expect_ok=False); self.assertIn('visual_selector_version',p.stderr)

 def test_normal_publication_sequence_is_independent_and_advances_once(self):
  target=article(); other=article('a-222222222222222222222222','Other','Before'); req=request(target); pubstate={'v':1,'sequence':59,'publication_id':'pub-v1-00000059-'+'9'*40,'article_id':'a-333333333333333333333333','ready_root':'9'*40,'article_digest':'a'*64,'dataset_digest':'b'*64}
  d,_,_,pub_text=self.run_case(dataset([target,other]),req,publication_state=json.dumps(pubstate,sort_keys=True)+'\n')
  self.assertEqual(pubstate,json.loads(pub_text))
  with tempfile.TemporaryDirectory() as td:
   p=Path(td); dp=p/'data.json'; rp=p/'normal.json'; sp=p/'publication-state.json'; op=p/'result.json'; dp.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n'); sp.write_text(json.dumps(pubstate,sort_keys=True)+'\n')
   updated=copy.deepcopy(next(x for x in d['articles'] if x['id']==other['id'])); updated['status']='UPDATE'; updated['public_summary']='Normal seq60'
   normal={'kind':'DISCOVERY_PUBLICATION_REQUEST_V1','schema_version':1,'publication_id':'pub-v1-00000060-'+'8'*40,'sequence':60,'operation':'UPDATE','article_id':updated['id'],'ready_root':'8'*40,'as_of':'2026-10-29','article':updated}; rp.write_text(json.dumps(normal,ensure_ascii=False))
   proc=subprocess.run(['python',str(NORMAL),str(rp),str(dp),str(sp),str(op)],text=True,capture_output=True); self.assertEqual(0,proc.returncode,proc.stderr); self.assertEqual(60,json.loads(sp.read_text())['sequence'])

 def test_later_normal_same_article_v7_update_does_not_regress_selector(self):
  a=article(); req=request(a); d,_,_,_=self.run_case(dataset([a]),req); current=d['articles'][0]
  pubstate={'v':1,'sequence':59,'publication_id':'pub-v1-00000059-'+'9'*40,'article_id':'a-333333333333333333333333','ready_root':'9'*40,'article_digest':'a'*64,'dataset_digest':'b'*64}
  with tempfile.TemporaryDirectory() as td:
   p=Path(td); dp=p/'data.json'; rp=p/'normal.json'; sp=p/'publication-state.json'; op=p/'result.json'; dp.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n'); sp.write_text(json.dumps(pubstate,sort_keys=True)+'\n')
   updated=copy.deepcopy(current); updated['status']='UPDATE'; updated['world_card']['variant']='orbit'; updated['display_selection']['selector_version']=7
   normal={'kind':'DISCOVERY_PUBLICATION_REQUEST_V1','schema_version':1,'publication_id':'pub-v1-00000060-'+'8'*40,'sequence':60,'operation':'UPDATE','article_id':updated['id'],'ready_root':'8'*40,'as_of':'2026-10-29','article':updated}; rp.write_text(json.dumps(normal,ensure_ascii=False))
   proc=subprocess.run(['python',str(NORMAL),str(rp),str(dp),str(sp),str(op)],text=True,capture_output=True); self.assertEqual(0,proc.returncode,proc.stderr); stored=json.loads(dp.read_text())['articles'][0]; self.assertEqual(7,stored['display_selection']['selector_version']); self.assertEqual('orbit',stored['world_card']['variant'])

if __name__=='__main__': unittest.main()
