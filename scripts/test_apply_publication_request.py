import copy
import hashlib
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name('apply_publication_request.py')


def article(article_id='a-111111111111111111111111', title='Example', summary='Summary', status='NEW', published='2026-10-24', updated='2026-10-24'):
    return {
        'id': article_id,
        'slug': article_id,
        'title': title,
        'public_summary': summary,
        'category': 'games',
        'status': status,
        'lifecycle': 'ACTIVE',
        'published_date': published,
        'updated_date': updated,
        'sources': [{'url': 'https://example.com/item', 'name': 'Official source'}],
        'spotify': [],
        'images': [],
        'world_card': {
            'key': 'world_card:' + article_id,
            'title': title,
            'kicker': 'GAME / DISCOVERY',
            'concept': summary,
            'meta': '',
            'variant': 'field',
        },
        'display_selection': {
            'selector_version': 4,
            'card_primary': {'kind': 'world_card', 'key': 'world_card:' + article_id},
            'detail_primary': {'kind': 'world_card', 'key': 'world_card:' + article_id},
            'detail_secondary': [],
        },
    }


def digest(value):
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
    return hashlib.sha256(raw).hexdigest()


def request(item, operation='NEW', private_revision='1' * 40, as_of='2026-10-24'):
    publication_id = 'pub-' + hashlib.sha256((private_revision + '\n' + item['id'] + '\n' + digest(item)).encode()).hexdigest()
    return {
        'kind': 'DISCOVERY_PUBLICATION_REQUEST_V1',
        'schema_version': 1,
        'publication_id': publication_id,
        'operation': operation,
        'article_id': item['id'],
        'private_revision': private_revision,
        'as_of': as_of,
        'article': item,
    }


def dataset(items=None):
    return {
        'schema_version': '1',
        'site_name': 'DISCOVERY',
        'as_of': '2026-10-23',
        'taxonomy': [{'id': 'games', 'label': 'ゲーム'}],
        'todays_pick': items[0]['id'] if items else None,
        'articles': list(items or []),
    }


class PublisherTests(unittest.TestCase):
    def run_case(self, data, req, expect_ok=True):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            data_path = root / 'data.json'
            req_path = root / 'request.json'
            result_path = root / 'result.json'
            data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            req_path.write_text(json.dumps(req, ensure_ascii=False), encoding='utf-8')
            proc = subprocess.run(['python', str(SCRIPT), str(req_path), str(data_path), str(result_path)], text=True, capture_output=True)
            if expect_ok:
                self.assertEqual(proc.returncode, 0, proc.stderr)
                return json.loads(data_path.read_text(encoding='utf-8')), json.loads(result_path.read_text(encoding='utf-8'))
            self.assertNotEqual(proc.returncode, 0)
            return proc

    def test_new_then_duplicate_is_no_change(self):
        item = article()
        data1, result1 = self.run_case(dataset(), request(item, 'NEW'))
        self.assertTrue(result1['changed'])
        self.assertEqual([x['id'] for x in data1['articles']], [item['id']])
        data2, result2 = self.run_case(data1, request(item, 'NEW'))
        self.assertFalse(result2['changed'])
        self.assertEqual(len(data2['articles']), 1)

    def test_update_replaces_stable_identity(self):
        old = article(summary='Old', status='NEW', published='2026-10-20', updated='2026-10-20')
        new = article(summary='New', status='UPDATE', published='2026-10-20', updated='2026-10-24')
        data2, result = self.run_case(dataset([old]), request(new, 'UPDATE', private_revision='2' * 40))
        self.assertTrue(result['changed'])
        self.assertEqual(len(data2['articles']), 1)
        self.assertEqual(data2['articles'][0]['public_summary'], 'New')

    def test_privacy_pattern_fails_closed(self):
        item = article(title='自宅のおすすめ')
        proc = self.run_case(dataset(), request(item, 'NEW'), expect_ok=False)
        self.assertIn('privacy_personal', proc.stderr)

    def test_conflicting_new_fails_closed(self):
        old = article(summary='Old')
        new = article(summary='Different')
        proc = self.run_case(dataset([old]), request(new, 'NEW'), expect_ok=False)
        self.assertIn('new_conflicts_existing', proc.stderr)


if __name__ == '__main__':
    unittest.main()
