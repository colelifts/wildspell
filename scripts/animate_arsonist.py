"""Build a seamless Arsonist card loop while preserving the supplied master art."""

from __future__ import annotations

import argparse
import math
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter


def screen_layer(base: Image.Image, layer: Image.Image, xy: tuple[int, int]) -> None:
    x, y = xy
    target = base.crop((x, y, x + layer.width, y + layer.height)).convert("RGB")
    screened = ImageChops.screen(target, layer.convert("RGB"))
    base.paste(screened, (x, y))


def flame_cells(sheet: Image.Image) -> list[Image.Image]:
    cell_width = sheet.width // 4
    cell_height = sheet.height // 2
    return [
        sheet.crop((column * cell_width, row * cell_height, (column + 1) * cell_width, (row + 1) * cell_height))
        for row in range(2)
        for column in range(4)
    ]


def glow_layer(size: tuple[int, int], center: tuple[int, int], radius: int, strength: float) -> Image.Image:
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    cx, cy = center
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=(int(155 * strength), int(44 * strength), 0))
    return layer.filter(ImageFilter.GaussianBlur(radius * 0.52))


def ember_layer(size: tuple[int, int], phase: float, count: int = 42) -> Image.Image:
    randomizer = random.Random(7317)
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    width, _ = size
    for index in range(count):
        start_x = randomizer.randint(70, width - 70)
        start_y = randomizer.randint(110, 1110)
        speed = randomizer.uniform(150, 330)
        drift = randomizer.uniform(8, 34)
        y = 110 + ((start_y - 110 - phase * speed) % 1000)
        x = start_x + math.sin(phase * math.tau + index * 1.73) * drift
        pulse = 0.45 + 0.55 * math.sin(phase * math.tau + index * 0.91) ** 2
        radius = randomizer.choice((1, 1, 2, 2, 3))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(int(255 * pulse), int(102 * pulse), int(16 * pulse)))
    return layer.filter(ImageFilter.GaussianBlur(0.55))


def heat_shimmer(frame: Image.Image, phase: float) -> None:
    left, top, right, bottom = 260, 70, 760, 455
    source = frame.crop((left, top, right, bottom))
    band_height = 14
    for y in range(0, source.height, band_height):
        shift = round(math.sin(phase * math.tau + y * 0.07) * 1.8)
        band = source.crop((0, y, source.width, min(source.height, y + band_height)))
        frame.paste(band, (left + shift, top + y))


def build_frames(master: Image.Image, sheet: Image.Image, frame_count: int) -> list[Image.Image]:
    cells = flame_cells(sheet)
    frames: list[Image.Image] = []
    for index in range(frame_count):
        phase = index / frame_count
        frame = master.convert("RGB").copy()
        heat_shimmer(frame, phase)

        flame = cells[(index * len(cells) // frame_count) % len(cells)].resize((390, 438), Image.Resampling.LANCZOS)
        flame = ImageEnhance.Brightness(flame).enhance(0.82 + 0.13 * math.sin(phase * math.tau) ** 2)
        screen_layer(frame, flame, (317, 18))

        orb_strength = 0.62 + 0.28 * math.sin(phase * math.tau) ** 2
        screen_layer(frame, glow_layer(frame.size, (342, 877), 172, orb_strength), (0, 0))
        eye_strength = 0.28 + 0.22 * math.sin(phase * math.tau + math.pi / 2) ** 2
        screen_layer(frame, glow_layer(frame.size, (511, 520), 38, eye_strength), (0, 0))
        screen_layer(frame, ember_layer(frame.size, phase), (0, 0))
        frames.append(frame)
    return frames


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--master", required=True, type=Path)
    parser.add_argument("--flames", required=True, type=Path)
    parser.add_argument("--webp", required=True, type=Path)
    parser.add_argument("--gif", required=True, type=Path)
    parser.add_argument("--sheet", required=True, type=Path)
    parser.add_argument("--frames", type=int, default=24)
    args = parser.parse_args()

    master = Image.open(args.master).convert("RGB")
    sheet = Image.open(args.flames).convert("RGB")
    frames = build_frames(master, sheet, args.frames)
    duration = round(2000 / args.frames)

    args.webp.parent.mkdir(parents=True, exist_ok=True)
    preview = [frame.resize((master.width // 2, master.height // 2), Image.Resampling.LANCZOS) for frame in frames]
    del frames
    preview[0].save(args.webp, save_all=True, append_images=preview[1:], duration=duration, loop=0, quality=84, method=5)
    preview[0].save(args.gif, save_all=True, append_images=preview[1:], duration=duration, loop=0, optimize=True, disposal=2)

    sheet = Image.new("RGB", (preview[0].width * 6, preview[0].height * 4), "black")
    for index, frame in enumerate(preview):
        sheet.paste(frame, ((index % 6) * frame.width, (index // 6) * frame.height))
    sheet.save(args.sheet, format="WEBP", quality=82, method=6)


if __name__ == "__main__":
    main()
