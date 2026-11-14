"""Regression for Public v8 Visual contract; standalone and side-effect free."""
import copy
import unittest

from visual_contract import FIRST_VISUAL_GATE_SEQUENCE, validate_first_visual


class FirstVisualTests(unittest.TestCase):
    def setUp(self):
        self.a = {
            'world_card': {'key': 'world_card:test'}, 'images': [],
            'display_selection': {
                'selector_version': 8,
                'card_primary': {'kind': 'world_card', 'key': 'world_card:test'},
                'detail_primary': {'kind': 'world_card', 'key': 'world_card:test'},
                'detail_secondary': [],
            },
        }

    def check(self, reason=None):
        def fail(s):
            raise ValueError(s)
        if reason is None:
            validate_first_visual(self.a, fail)
        else:
            with self.assertRaisesRegex(ValueError, reason):
                validate_first_visual(self.a, fail)

    def video(self):
        self.a['media'] = [{
            'type': 'youtube_embed',
            'canonical_url': 'https://www.youtube.com/watch?v=12345678901',
            'visual_provenance': {
                'official_source': True, 'source_revalidated': True,
                'entity_match': True, 'relation': 'official_entity',
            },
        }]
        return {'kind': 'media',
                'key': 'media:https://www.youtube.com/watch?v=12345678901'}

    def static(self, relation='official_entity'):
        self.a['images'] = [{
            'url': 'https://example.org/photo.jpg',
            'relation': relation,
            'visual_provenance': {
                'article_match': False, 'entity_match': relation != 'related_official_reference',
                'relation': relation,
            },
        }]
        return {'kind': 'image', 'key': 'image:https://example.org/photo.jpg'}

    def test_cutover(self):
        self.assertEqual(105, FIRST_VISUAL_GATE_SEQUENCE)

    def test_world_only_valid(self):
        self.check()

    def test_world_missing_fails(self):
        del self.a['world_card']
        self.check('visual_world_fallback_missing')

    def test_selection_missing_fails(self):
        del self.a['display_selection']
        self.check('visual_v8_selection_required')

    def test_old_version_fails(self):
        self.a['display_selection']['selector_version'] = 7
        self.check('visual_v8_selection_required')

    def test_video_only_valid(self):
        ref = self.video()
        self.a['display_selection']['card_primary'] = ref
        self.a['display_selection']['detail_primary'] = ref
        self.check()

    def test_media_ref_unbound_fails(self):
        self.video()
        self.a['display_selection']['card_primary'] = {'kind': 'media', 'key': 'media:missing'}
        self.check('visual_selection_unbound')

    def test_world_not_last_fails(self):
        self.video()
        self.check('visual_world_not_last')

    def test_x_detail_only_can_pair_with_world_card(self):
        self.a['media'] = [{'type': 'x_embed', 'canonical_url': 'https://x.com/account/status/12345'}]
        self.a['display_selection']['detail_primary'] = {
            'kind': 'media', 'key': 'media:https://x.com/account/status/12345'}
        self.check()

    def test_x_card_not_capable(self):
        self.a['media'] = [{'type': 'x_embed', 'canonical_url': 'https://x.com/account/status/12345'}]
        ref = {'kind': 'media', 'key': 'media:https://x.com/account/status/12345'}
        self.a['display_selection']['card_primary'] = ref
        self.a['display_selection']['detail_primary'] = ref
        self.check('visual_card_media_not_capable')

    def test_static_first(self):
        image = self.static()
        media = self.video()
        self.a['display_selection']['card_primary'] = media
        self.a['display_selection']['detail_primary'] = media
        self.check('visual_card_static_priority')
        self.a['display_selection']['card_primary'] = image
        self.check()

    def test_weak_static_follows_embed(self):
        image = self.static('related_official_reference')
        media = self.video()
        self.a['display_selection']['card_primary'] = image
        self.a['display_selection']['detail_primary'] = image
        self.check('visual_card_weak_static_priority')
        self.a['display_selection']['card_primary'] = media
        self.check()

    def test_image_ref_must_bind_actual_original(self):
        self.static()
        self.a['display_selection']['card_primary'] = {'kind': 'image', 'key': 'image:other'}
        self.check('visual_selection_unbound')

    def test_detail_world_not_rendered_when_real_exists(self):
        self.a['display_selection']['card_primary'] = self.static()
        self.check('visual_detail_world_not_last')


if __name__ == '__main__':
    unittest.main()
