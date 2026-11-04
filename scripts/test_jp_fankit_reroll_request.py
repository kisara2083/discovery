import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import apply_visual_maintenance_request as vm
import public_saved_asset_hydration as hydration
from build_jp_fankit_reroll_request import build, KIND
from test_apply_visual_maintenance_request import article, dataset


def png(payload=b"new"):
    return bytes((137, 80, 78, 71, 13, 10, 26, 10)) + payload


class JpFankitRerollTests(unittest.TestCase):
    def setup_case(self, directory, selected=None):
        root = Path(directory)
        (root / "data").mkdir()
        a = article()
        original = next(iter(sorted(hydration._jp_wallpaper_urls())))
        chosen = selected or sorted(hydration._jp_wallpaper_urls())[1]
        old = {
            "url": "assets/images/" + "a" * 64 + ".png",
            "original_url": original,
            "source_page": hydration.ARK_FANKIT,
            "relation": "reference_same_entity",
            "caption": "Old fan kit",
            "mode": "saved",
            "framing": "contain",
            "visual_provenance": {
                "relation": "official_entity",
                "official_source": True,
                "source_revalidated": True,
                "article_match": False,
                "entity_match": True,
                "authority_class": "official_entity",
            },
        }
        a["images"] = [old]
        a["display_selection"] = {
            "selector_version": 8,
            "card_primary": {"kind": "image", "key": "image:" + original},
            "detail_primary": {"kind": "image", "key": "image:" + original},
            "detail_secondary": [],
        }
        dp = root / "data" / "public-data.json"
        rp = root / "req.json"
        dp.write_text(json.dumps(dataset([a]), ensure_ascii=False), encoding="utf-8")
        rp.write_text(json.dumps({
            "kind": KIND, "schema_version": 1, "article_id": a["id"],
            "expected_article_digest": vm.digest(a), "chosen_url": chosen,
        }), encoding="utf-8")
        return a, dp, rp, chosen

    def test_one_bound_article_preserves_facts_and_generates_valid_request(self):
        with tempfile.TemporaryDirectory() as td:
            original, dp, rp, chosen = self.setup_case(td)
            data_before = dp.read_bytes()
            blob = png(b"image")
            output = build(rp, dp, downloader=lambda url: (blob, "png"))
            vm.validate_request(output)
            self.assertEqual(dp.read_bytes(), data_before)
            self.assertEqual(output["expected_article_digest"], vm.digest(original))
            v = output["visual"]
            self.assertEqual(v["images"][0]["original_url"], chosen)
            self.assertEqual(v["images"][0]["mode"], "saved")
            self.assertEqual(v["images"][0]["framing"], "contain")
            self.assertEqual(v["display_selection"]["card_primary"]["key"], "image:" + chosen)
            self.assertEqual(v["display_selection"]["detail_primary"]["key"], "image:" + chosen)
            self.assertEqual(v["media"], original["media"])
            self.assertEqual(v["world_card"], original["world_card"])
            self.assertEqual((Path(td) / v["images"][0]["url"]).read_bytes(), blob)
            self.assertEqual(output, json.loads(rp.read_text(encoding="utf-8")))

    def test_global_or_unreviewed_source_rejected_before_download(self):
        with tempfile.TemporaryDirectory() as td:
            _, dp, rp, _ = self.setup_case(td)
            payload = json.loads(rp.read_text())
            payload["chosen_url"] = "https://webusstatic.yo-star.com/web-cms-test/upload/content/2026/10/31/0NhCBA83.png"
            rp.write_text(json.dumps(payload))
            with self.assertRaisesRegex(ValueError, "not_allowlisted"):
                build(rp, dp, downloader=lambda url: (_ for _ in ()).throw(AssertionError("must not fetch")))

    def test_stale_article_and_secondary_only_fail_before_download(self):
        with tempfile.TemporaryDirectory() as td:
            a, dp, rp, _ = self.setup_case(td)
            payload = json.loads(rp.read_text())
            payload["expected_article_digest"] = "0" * 64
            rp.write_text(json.dumps(payload))
            with self.assertRaisesRegex(ValueError, "article_digest_mismatch"):
                build(rp, dp, downloader=lambda u: (_ for _ in ()).throw(AssertionError("download")))
            payload["expected_article_digest"] = vm.digest(a)
            rp.write_text(json.dumps(payload))
            data = json.loads(dp.read_text())
            card = data["articles"][0]["display_selection"]
            card["detail_secondary"] = [card["card_primary"]]
            card["card_primary"] = None
            card["detail_primary"] = None
            dp.write_text(json.dumps(data, ensure_ascii=False))
            payload["expected_article_digest"] = vm.digest(data["articles"][0])
            rp.write_text(json.dumps(payload))
            with self.assertRaisesRegex(ValueError, "primary_required"):
                build(rp, dp, downloader=lambda u: (_ for _ in ()).throw(AssertionError("download")))


if __name__ == "__main__":
    unittest.main()
