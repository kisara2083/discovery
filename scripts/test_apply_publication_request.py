import json, subprocess, tempfile, unittest
from pathlib import Path
SCRIPT=Path(__file__).with_name('apply_publication_request.py')
def article(article_id='a-111111111111111111111111',title='Example',summary='Summary',status='NEW',published='2026-10-24',updated='2026-10-24'):
 return {'id':article_id,'slug':article_id,'title':title,'public_summary':summary,'category':'games','status':status,'lifecycle':'ACTIVE','published_date':published,'updated_date':updated,'sources':[{'url':'https://example.com/item','name':'Official source'}],'spotify':[],'images':[],'world_card':{'key':'world_card:'+article_id,'title':title,'kicker':'GAME / DISCOVERY','concept':summary,'meta':'','variant':'field'},'display_selection':{'selector_version':4,'card_primary':{'kind':'world_card','key':'world_card:'+article_id},'detail_primary':{'kind':'world_card','key':'world_card:'+article_id},'detail_secondary':[]}}
def request(item,sequence=1,operation='NEW',root='a'*40,as_of='2026-10-24'):
 return {'kind':'DISCOVERY_PUBLICATION_REQUEST_V1','schema_version':1,'publication_id':f'pub-v1-{sequence:08d}-{root}','sequence':sequence,'operation':operation,'article_id':item['id'],'ready_root':root,'as_of':as_of,'article':item}
def dataset(items=None,as_of='2026-10-23'):
 return {'schema_version':'1','site_name':'DISCOVERY','as_of':as_of,'taxonomy':[{'id':'games','label':'ゲーム'}],'todays_pick':items[0]['id'] if items else None,'articles':list(items or [])}
class PublisherTests(unittest.TestCase):
 def test_v7_accepted_and_v6_compatible(self):
  for version in (6,7):
   item=article(); item['display_selection']['selector_version']=version
   d,_,_=self.run_case(dataset(),request(item)); self.assertEqual(version,d['articles'][0]['display_selection']['selector_version'])
 def test_v7_selector_only_preserves_updated_date(self):
  d,s,_=self.run_case(dataset(),request(article()))
  item=json.loads(json.dumps(d['articles'][0])); item['display_selection']['selector_version']=7
  after,_,_=self.run_case(d,request(item,2,'UPDATE','b'*40,'2026-10-25'),s)
  self.assertEqual(d['articles'][0]['updated_date'],after['articles'][0]['updated_date'])
 def test_v7_rejects_invalid_secondary(self):
  for secondary,primary,error in (([{'kind':'world_card','key':'world_card:x'}],None,'secondary_world'),([{'kind':'image','key':'image:x'}]*2,None,'secondary_duplicate'),([{'kind':'image','key':'image:x'}],{'kind':'image','key':'image:x'},'secondary_duplicate'),([{'kind':'bogus','key':'x'}],None,'detail_secondary_ref_value'),([{'kind':'image','key':''}],None,'detail_secondary_ref_value'),([None],None,'secondary_world'),([{'kind':'image','key':'image:'+str(i)} for i in range(5)],None,'detail_secondary')):
   item=article(); d=item['display_selection']; d['selector_version']=7; d['detail_secondary']=secondary
   if primary is not None:d['detail_primary']=primary
   proc=self.run_case(dataset(),request(item),expect_ok=False); self.assertIn(error,proc.stderr)
 def run_case(self,data,req,state=None,expect_ok=True):
  with tempfile.TemporaryDirectory() as td:
   p=Path(td); dp=p/'data.json'; rp=p/'request.json'; sp=p/'state.json'; op=p/'result.json'; dp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n'); rp.write_text(json.dumps(req,ensure_ascii=False))
   if state is not None: sp.write_text(json.dumps(state,sort_keys=True)+'\n')
   proc=subprocess.run(['python',str(SCRIPT),str(rp),str(dp),str(sp),str(op)],text=True,capture_output=True)
   if not expect_ok: self.assertNotEqual(proc.returncode,0); return proc
   self.assertEqual(proc.returncode,0,proc.stderr); return json.loads(dp.read_text()),json.loads(sp.read_text()),json.loads(op.read_text())
 def test_new_then_exact_duplicate_is_no_change(self):
  item=article(); d1,s1,r1=self.run_case(dataset(),request(item)); self.assertTrue(r1['snapshot_changed']); self.assertTrue(r1['receipt_changed']); self.assertEqual(1,s1['sequence']); self.assertNotIn('private_revision',s1)
  d2,s2,r2=self.run_case(d1,request(item),s1); self.assertFalse(r2['changed']); self.assertEqual(s1,s2); self.assertEqual(1,len(d2['articles']))
 def test_existing_exact_article_still_creates_receipt_only(self):
  item=article(); d,s,r=self.run_case(dataset([item],as_of='2026-10-24'),request(item)); self.assertFalse(r['snapshot_changed']); self.assertTrue(r['receipt_changed']); self.assertTrue(r['changed']); self.assertEqual(item['id'],s['article_id'])
 def test_update_sequence_two_replaces_stable_identity(self):
  old=article(summary='Old',status='NEW',published='2026-10-20',updated='2026-10-20'); new=article(summary='New',status='UPDATE',published='2026-10-20',updated='2026-10-24'); d1,s1,_=self.run_case(dataset(),request(old,1,'NEW','a'*40)); d2,s2,r2=self.run_case(d1,request(new,2,'UPDATE','b'*40),s1); self.assertTrue(r2['changed']); self.assertEqual(2,s2['sequence']); self.assertEqual('New',d2['articles'][0]['public_summary']); self.assertEqual(old['id'],d2['articles'][0]['id'])
 def test_new_article_updated_date_is_publication_date(self):
  item=article(updated='2026-10-01'); d,_,_=self.run_case(dataset(),request(item,as_of='2026-10-24')); self.assertEqual('2026-10-24',d['articles'][0]['updated_date'])
 def test_technical_update_preserves_updated_date(self):
  old=article(updated='2026-10-20'); d1,s1,_=self.run_case(dataset(),request(old,1,'NEW','a'*40,as_of='2026-10-24'))
  technical=article(status='UPDATE',updated='2026-10-25'); technical['display_selection']['selector_version']=6; technical['sources'].append({'url':'https://example.com/more-evidence','name':'More evidence'})
  d2,_,_=self.run_case(d1,request(technical,2,'UPDATE','b'*40,as_of='2026-10-25'),s1); self.assertEqual('2026-10-24',d2['articles'][0]['updated_date'])
 def test_meaningful_update_uses_publication_date(self):
  old=article(summary='Old',updated='2026-10-20'); d1,s1,_=self.run_case(dataset(),request(old,1,'NEW','a'*40,as_of='2026-10-24'))
  new=article(summary='New',status='UPDATE',updated='2026-01-01'); d2,_,_=self.run_case(d1,request(new,2,'UPDATE','b'*40,as_of='2026-10-25'),s1); self.assertEqual('2026-10-25',d2['articles'][0]['updated_date'])
 def test_sequence_gap_and_stale_fail_closed(self):
  item=article(); d1,s1,_=self.run_case(dataset(),request(item)); p=self.run_case(d1,request(item,3,'UPDATE','c'*40),s1,False); self.assertIn('sequence_gap_or_stale',p.stderr); p=self.run_case(d1,request(item,1,'NEW','d'*40),s1,False); self.assertIn('sequence_conflict',p.stderr)
 def test_privacy_pattern_fails_closed(self):
  p=self.run_case(dataset(),request(article(title='自宅のおすすめ')),expect_ok=False); self.assertIn('privacy_personal',p.stderr)
 def test_private_metadata_field_is_rejected(self):
  req=request(article()); req['private_revision']='1'*40; p=self.run_case(dataset(),req,expect_ok=False); self.assertIn('request_unknown_fields',p.stderr)
 def test_conflicting_new_fails_closed(self):
  p=self.run_case(dataset([article(summary='Old')]),request(article(summary='Different')),expect_ok=False); self.assertIn('new_conflicts_existing',p.stderr)
 def test_delayed_backlog_refreshes_lifecycle(self):
  delayed=article(); delayed['end_at']='2026-10-23T23:59:59+09:00'; self.assertEqual('ACTIVE',delayed['lifecycle'])
  d,s,r=self.run_case(dataset(),request(delayed)); stored=next(x for x in d['articles'] if x['id']==delayed['id']); self.assertEqual('ENDED',stored['lifecycle']); self.assertEqual('ENDED',stored['lifecycle']); self.assertTrue(r['snapshot_changed'])
if __name__=='__main__': unittest.main()
