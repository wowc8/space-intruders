"""Pack existing original PNG art into a Windows ICO without extra dependencies."""

from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1] / "src-tauri" / "icons"
IMAGES = [(32, ROOT / "32x32.png"), (128, ROOT / "128x128.png"), (256, ROOT / "128x128@2x.png")]
payloads = [path.read_bytes() for _, path in IMAGES]
header = struct.pack("<HHH", 0, 1, len(IMAGES))
offset = len(header) + 16 * len(IMAGES)
entries = []
for (size, _), payload in zip(IMAGES, payloads):
    entries.append(struct.pack("<BBBBHHII", size % 256, size % 256, 0, 0, 1, 32, len(payload), offset))
    offset += len(payload)
(ROOT / "icon.ico").write_bytes(header + b"".join(entries) + b"".join(payloads))
