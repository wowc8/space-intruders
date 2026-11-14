"""Generate the original Space Intruders app icon with Python's standard library."""
import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "src-tauri" / "icons"
ICONS.mkdir(parents=True, exist_ok=True)


def png_chunk(kind: bytes, payload: bytes) -> bytes:
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload))


def inside_poly(x: float, y: float, vertices: list[tuple[float, float]]) -> bool:
    result = False
    j = len(vertices) - 1
    for i, (xi, yi) in enumerate(vertices):
        xj, yj = vertices[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            result = not result
        j = i
    return result


def color(x: float, y: float) -> tuple[int, int, int, int]:
    # Dark indigo tile, three warm thrusters, and a geometric cyan interceptor.
    u, v = x / 1024, y / 1024
    if not (0.055 < u < 0.945 and 0.055 < v < 0.945):
        return (0, 0, 0, 0)
    if min(u - 0.055, 0.945 - u, v - 0.055, 0.945 - v) < 0.09:
        cx = 0.145 if u < 0.5 else 0.855
        cy = 0.145 if v < 0.5 else 0.855
        if (u - cx) ** 2 + (v - cy) ** 2 > 0.09 ** 2 and (u < 0.145 or u > 0.855) and (v < 0.145 or v > 0.855):
            return (0, 0, 0, 0)
    base = (9, 14, 31, 255)
    if 0.30 < v < 0.64 and any(abs(u - c) < 0.018 for c in (0.34, 0.5, 0.66)):
        return (255, 160, 68, 255)
    hull = [(0.18, 0.59), (0.32, 0.51), (0.38, 0.37), (0.5, 0.31),
            (0.62, 0.37), (0.68, 0.51), (0.82, 0.59), (0.74, 0.68),
            (0.61, 0.64), (0.5, 0.73), (0.39, 0.64), (0.26, 0.68)]
    if inside_poly(u, v, hull):
        if (u - 0.5) ** 2 / 0.07 ** 2 + (v - 0.46) ** 2 / 0.08 ** 2 < 1:
            return (255, 196, 93, 255)
        return (74, 229, 230, 255)
    return base


def write_png(path: Path, size: int) -> None:
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            rows.extend(color((x + .5) * 1024 / size, (y + .5) * 1024 / size))
    data = b"\x89PNG\r\n\x1a\n"
    data += png_chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    data += png_chunk(b"IDAT", zlib.compress(rows, 9))
    data += png_chunk(b"IEND", b"")
    path.write_bytes(data)


for name, size in (("32x32.png", 32), ("128x128.png", 128), ("128x128@2x.png", 256)):
    write_png(ICONS / name, size)

iconset = ICONS / "SpaceIntruders.iconset"
iconset.mkdir(exist_ok=True)
for name, size in (
    ("icon_16x16.png", 16), ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32), ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128), ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256), ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512), ("icon_512x512@2x.png", 1024),
):
    write_png(iconset / name, size)
