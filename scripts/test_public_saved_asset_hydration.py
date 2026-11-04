import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import public_saved_asset_hydration as hydration


def png(payload=b"x"):
    return b"\x89PNG\r\n\x1a\n" + payload


class SavedAssetHydrationTests(unittest.TestCase):
    def test_fankit_saved_asset_hydrates_and_verifies_hash(self):
        blob = png(b"fan")
        digest = hashlib.sha256(blob).hexdigest()
        image = {
            "mode": "saved",
            "url": f"assets/images/{digest}.png",
            "original_url": "https://webusstatic.yo-star.com/ark_jp_web/assets/158641056122110370/01.jpg",
            "source_page": "https://www.arknights.jp/fankit/",
        }
        with tempfile.TemporaryDirectory() as td, patch.object(hydration, "_public_host", lambda _host: None):
            created = hydration.hydrate(
                {"images": [image]}, td,
                downloader=lambda _url: (blob, "png"))
            self.assertEqual(created, [image["url"]])
            self.assertEqual((Path(td) / image["url"]).read_bytes(), blob)
            self.assertEqual(hydration.hydrate(
                {"images": [image]}, td,
                downloader=lambda _url: (_ for _ in ()).throw(AssertionError("no fetch"))), [])

    def test_jp_wallpaper_exact_allowlist_including_new_cdn_paths(self):
        urls = hydration._jp_wallpaper_urls()
        self.assertEqual(len(urls), 69)
        self.assertIn("https://webusstatic.yo-star.com/web-cms-test/upload/content/2026/09/23/Xba2hKmv.jpg", urls)
        self.assertIn("https://webusstatic.yo-star.com/web-cms-prod/upload/content/2026/04/22/GcKcNs-9.jpeg", urls)
        self.assertNotIn("https://webusstatic.yo-star.com/ark_jp_web/assets/159168848582015563/01.png", urls)
        with patch.object(hydration, "_public_host", lambda _host: None):
            for original in (
                "https://webusstatic.yo-star.com/web-cms-test/upload/content/2026/09/23/Xba2hKmv.jpg",
                "https://webusstatic.yo-star.com/web-cms-prod/upload/content/2026/04/22/GcKcNs-9.jpeg",
            ):
                self.assertTrue(hydration._eligible({
                    "mode": "saved", "original_url": original,
                    "source_page": hydration.ARK_FANKIT}))
            for original in (
                "https://webusstatic.yo-star.com/web-cms-test/upload/content/2026/10/31/0NhCBA83.png",
                "https://webusstatic.yo-star.com/ark_jp_web/assets/159168848582015563/01.png",
                "https://example.com/unobserved.jpg",
            ):
                self.assertFalse(hydration._eligible({
                    "mode": "saved", "original_url": original,
                    "source_page": hydration.ARK_FANKIT}))

    def test_hash_mismatch_fails_closed(self):
        blob = png(b"a")
        digest = hashlib.sha256(blob).hexdigest()
        image = {
            "mode": "saved",
            "url": f"assets/images/{digest}.png",
            "original_url": "https://webusstatic.yo-star.com/ark_jp_web/assets/158641056122110370/01.jpg",
            "source_page": "https://www.arknights.jp/fankit/",
        }
        with tempfile.TemporaryDirectory() as td, patch.object(hydration, "_public_host", lambda _host: None):
            with self.assertRaisesRegex(ValueError, "asset_hydration_digest"):
                hydration.hydrate({"images": [image]}, td, downloader=lambda _url: (png(b"b"), "png"))

    def test_unreviewed_arbitrary_saved_url_is_rejected(self):
        blob = png(b"a")
        digest = hashlib.sha256(blob).hexdigest()
        image = {
            "mode": "saved",
            "url": f"assets/images/{digest}.png",
            "original_url": "https://example.com/a.png",
            "source_page": "https://example.com/page",
        }
        with tempfile.TemporaryDirectory() as td, patch.object(hydration, "_public_host", lambda _host: None):
            with self.assertRaisesRegex(ValueError, "asset_hydration_not_allowed"):
                hydration.hydrate({"images": [image]}, td, downloader=lambda _url: (blob, "png"))

    def test_saved_quoted_image_is_allowed_only_with_public_binding(self):
        blob = png(b"q")
        digest = hashlib.sha256(blob).hexdigest()
        image = {
            "mode": "saved",
            "url": f"assets/images/{digest}.png",
            "original_url": "https://pbs.twimg.com/media/example.png",
            "source_page": "https://x.com/ArknightsStaff/status/2087441501072843214",
            "quote_context": {
                "display_mode": "saved",
                "source_page": "https://x.com/ArknightsStaff/status/2087441501072843214",
            },
            "visual_provenance": {"source_revalidated": True},
        }
        with tempfile.TemporaryDirectory() as td, patch.object(hydration, "_public_host", lambda _host: None):
            self.assertEqual(len(hydration.hydrate(
                {"images": [image]}, td, downloader=lambda _url: (blob, "png"))), 1)
            bad = dict(image, quote_context={"display_mode": "saved", "source_page": "https://x.com/other/status/1"})
            bad["url"] = f"assets/images/{hashlib.sha256(png(b'z')).hexdigest()}.png"
            with self.assertRaisesRegex(ValueError, "asset_hydration_not_allowed"):
                hydration.hydrate({"images": [bad]}, td, downloader=lambda _url: (png(b"z"), "png"))


if __name__ == "__main__":
    unittest.main()
