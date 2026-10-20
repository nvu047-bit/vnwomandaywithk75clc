"""Local-only capture server for tests/shared-galaxy-browser.html.

Run with: python tests/shared-galaxy-capture-server.py
Then open http://127.0.0.1:8765/tests/shared-galaxy-browser.html?profile=desktop
Only binds to loopback. Captures are stored under verification/shared-galaxy/screenshots.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import json
import re

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "verification" / "shared-galaxy" / "screenshots"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        parsed = urlparse(self.path)
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_error(400, "Invalid Content-Length")
            return
        if length <= 0 or length > 15 * 1024 * 1024:
            self.send_error(413, "Payload must be between 1 byte and 15 MiB")
            return
        payload = self.rfile.read(length)

        if parsed.path == "/__capture":
            name = parse_qs(parsed.query).get("name", [""])[0]
            if not re.fullmatch(r"(?:desktop|mobile)_\d{2}s\.png", name):
                self.send_error(400, "Unexpected screenshot filename")
                return
            if self.headers.get_content_type() != "image/png":
                self.send_error(415, "Expected image/png")
                return
            target = OUTPUT_DIR / name
        elif parsed.path == "/__report":
            if self.headers.get_content_type() != "application/json":
                self.send_error(415, "Expected application/json")
                return
            target = OUTPUT_DIR / "browser-report.json"
            try:
                json.loads(payload.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                self.send_error(400, "Invalid JSON report")
                return
        else:
            self.send_error(404)
            return

        target.write_bytes(payload)
        self.send_response(201)
        self.end_headers()
        self.wfile.write(b"saved")


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8765), Handler)
    print(f"Serving STELLAR browser fixture at http://127.0.0.1:8765/ (captures: {OUTPUT_DIR})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
