import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import public_saved_asset_hydration as hydration


def png(payload=b"x"):
    return b"\x89PNG\r\n\x1a\n" + payload


class _DownloadResponse:
    def __init__(self, url, payload):
        self.url = url
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self, limit):
        return self.payload[:limit]


class SavedAssetHydrationTests(unittest.TestCase):

    def test_rate_limit_respects_retry_after_and_uses_contact_user_agent(self):
        url = "https://upload.wikimedia.org/wikipedia/commons/a/sample.png"
        transient = hydration.urllib.error.HTTPError(url, 429, "limited", {"Retry-After": "7"}, None)
        with (patch.object(hydration, "_public_host", lambda _host: None),
              patch.object(hydration.urllib.request, "urlopen",
                           side_effect=[transient, _DownloadResponse(url, png())]) as open_url,
              patch.object(hydration.time, "sleep") as sleep):
            self.assertEqual(hydration.fetch(url), (png(), "png"))
            self.assertEqual(open_url.call_count, 2)
            self.assertIn("github.com/kisara2083/discovery",
                          open_url.call_args_list[0].args[0].get_header("User-agent"))
            sleep.assert_called_once_with(7)

    def test_long_rate_limit_does_not_retry_past_budget(self):
        url = "https://upload.wikimedia.org/wikipedia/commons/a/sample.png"
        transient = hydration.urllib.error.HTTPError(url, 429, "limited", {"Retry-After": "3600"}, None)
        with (patch.object(hydration, "_public_host", lambda _host: None),
              patch.object(hydration.urllib.request, "urlopen",
                           side_effect=transient) as open_url,
              patch.object(hydration.time, "sleep") as sleep):
            with self.assertRaises(hydration.urllib.error.HTTPError):
                hydration.fetch(url)
            open_url.assert_called_once()
            sleep.assert_not_called()

    def test_permanent_http_error_fails_without_retry(self):
        url = "https://upload.wikimedia.org/wikipedia/commons/a/sample.png"
        denied = hydration.urllib.error.HTTPError(url, 403, "forbidden", {}, None)
        with (patch.object(hydration, "_public_host", lambda _host: None),
              patch.object(hydration.urllib.request, "urlopen",
                           side_effect=denied) as open_url,
              patch.object(hydration.time, "sleep") as sleep):
            with self.assertRaises(hydration.urllib.error.HTTPError):
                hydration.fetch(url)
            open_url.assert_called_once()
            sleep.assert_not_called()

    def test_connection_failure_uses_bounded_retry(self):
        url = "https://upload.wikimedia.org/wikipedia/commons/a/sample.png"
        transient = hydration.urllib.error.URLError("connection reset")
        with (patch.object(hydration, "_public_host", lambda _host: None),
              patch.object(hydration.urllib.request, "urlopen",
                           side_effect=[transient, _DownloadResponse(url, png())]) as open_url,
              patch.object(hydration.time, "sleep") as sleep):
            self.assertEqual(hydration.fetch(url), (png(), "png"))
            self.assertEqual(open_url.call_count, 2)
            sleep.assert_called_once_with(4)

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
