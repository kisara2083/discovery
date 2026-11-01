import copy
import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name('apply_publication_request.py')
SPEC = importlib.util.spec_from_file_location('publication', SCRIPT)
publication = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(publication)


def article():
    article_id = 'a-' + '1' * 24
    return {
        'id': article_id,
        'slug': article_id,
        'title': 'Example',
        'public_summary': 'Summary',
        'public_detail': 'Neutral detail',
        'category': 'games',
        'status': 'NEW',
        'lifecycle': 'ACTIVE',
        'published_date': '2026-11-01',
        'updated_date': '2026-11-01',
        'sources': [{'url': 'https://example.com/item', 'name': 'Source'}],
        'spotify': [],
        'images': [],
    }


class MatchTagsTests(unittest.TestCase):
    def test_valid_match_keywords_are_public_safe_metadata(self):
        value = article()
        value['match_tags'] = ['後ノリ', '対位法', '多層アンサンブル']
        publication.validate_article(value, {'games'})

    def test_match_keywords_are_bounded_and_unique(self):
        duplicate = article()
        duplicate['match_tags'] = ['対位法', '対位法']
        with self.assertRaisesRegex(ValueError, 'match_tags'):
            publication.validate_article(duplicate, {'games'})

        too_many = article()
        too_many['match_tags'] = [f'tag-{i}' for i in range(9)]
        with self.assertRaisesRegex(ValueError, 'match_tags'):
            publication.validate_article(too_many, {'games'})

    def test_match_only_change_does_not_change_meaningful_content(self):
        before = article()
        after = copy.deepcopy(before)
        before['match_tags'] = ['後ノリ']
        after['match_tags'] = ['対位法']
        self.assertEqual(publication.meaningful(before), publication.meaningful(after))


if __name__ == '__main__':
    unittest.main()
