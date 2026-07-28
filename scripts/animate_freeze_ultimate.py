"""Create a seamless, cinematic Freeze card loop from the final master artwork."""

from __future__ import annotations

import argparse
import math
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps


ART_BOX = (45, 48, 979, 1128)


def screen(base: Image.Image, layer: Image.Image, amount: float = 1.0) -> None:
    mixed = ImageChops.screen(base.convert("RGB"), layer.convert("RGB"))
    base.paste(mixed if amount >= 1 else Image.blend(base, mixed, amount))


def soft_paste(base: Image.Image, source: Image.Image, box: tuple[int, int, int, int], feather: int) -> None:
    width, height = box[2] - box[0], box[3] - box[1]
    mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(mask).rounded_rectangle((feather, feather, width - feather, height - feather), radius=feather, fill=255)
    base.paste(source, box[:2], mask.filter(ImageFilter.GaussianBlur(feather)))


def camera(master: Image.Image, phase: float) -> Image.Image:
    frame = master.copy()
    art = master.crop(ART_BOX)
    ease = 0.5 - 0.5 * math.cos(phase * math.tau)
    zoom = 1.002 + 0.004 * ease
    width, height = round(art.width * zoom), round(art.height * zoom)
    enlarged = art.resize((width, height), Image.Resampling.BICUBIC)
    drift_x = round(math.sin(phase * math.tau) * 1.5)
    drift_y = round(math.sin(phase * math.tau + math.pi / 2) * 1.0)
    left = (width - art.width) // 2 + drift_x
    top = (height - art.height) // 2 + drift_y
    frame.paste(enlarged.crop((left, top, left + art.width, top + art.height)), ART_BOX[:2])
    return frame


def frozen_shiver(frame: Image.Image, phase: float) -> None:
    box = (600, 325, 975, 1110)
    source = frame.crop(box)
    # Two short, sharp tremors per loop separated by long stillness.
    envelope = max(0.0, math.sin(phase * math.tau * 2 - 0.35)) ** 12
    shift = round(math.sin(phase * math.tau * 18) * 2.2 * envelope)
    moved = Image.new("RGB", source.size, "black")
    moved.paste(source, (shift, 0))
    soft_paste(frame, moved, box, 48)


def crystal_energy(size: tuple[int, int], phase: float) -> Image.Image:
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    paths = [
        [(378, 605), (440, 535), (515, 455), (590, 360), (655, 247), (707, 132)],
        [(460, 520), (560, 410), (690, 345), (780, 264)],
        [(475, 520), (575, 430), (690, 420), (810, 402)],
        [(450, 545), (530, 480), (595, 500), (690, 548)],
    ]
    position = phase
    for path_index, path in enumerate(paths):
        # Sample each polyline into a smooth chain and place a travelling pulse.
        samples: list[tuple[float, float]] = []
        for start, end in zip(path, path[1:]):
            for step in range(12):
                t = step / 12
                samples.append((start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t))
        samples.append(path[-1])
        head = (position + path_index * 0.075) % 1.0
        for index, (x, y) in enumerate(samples):
            distance = min(abs(index / (len(samples) - 1) - head), 1 - abs(index / (len(samples) - 1) - head))
            intensity = max(0.0, 1.0 - distance / 0.12) ** 2
            if intensity <= 0:
                continue
            radius = 2 + 7 * intensity
            color = (round(110 * intensity), round(220 * intensity), round(255 * intensity))
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
    return layer.filter(ImageFilter.GaussianBlur(5.5))


def snow(size: tuple[int, int], phase: float, depth: int) -> Image.Image:
    rng = random.Random(7319 + depth)
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    count = (42, 26, 14)[depth]
    speed = (120, 205, 310)[depth]
    for index in range(count):
        start_x = rng.randint(55, size[0] - 55)
        start_y = rng.randint(55, 1120)
        y = 55 + ((start_y - 55 + phase * speed) % 1065)
        x = start_x + math.sin(phase * math.tau + index * 1.17) * (5 + depth * 9)
        twinkle = 0.35 + 0.65 * math.sin(phase * math.tau + index * 0.83) ** 2
        radius = 1 + depth + rng.choice((0, 0, 1))
        color = (round(110 * twinkle), round(205 * twinkle), round(255 * twinkle))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
        if depth == 2 and index % 3 == 0:
            draw.line((x - radius * 2, y, x + radius * 2, y), fill=color, width=1)
            draw.line((x, y - radius * 2, x, y + radius * 2), fill=color, width=1)
    return layer.filter(ImageFilter.GaussianBlur(0.35 + depth * 0.55))


def cold_mist(size: tuple[int, int], phase: float) -> Image.Image:
    rng = random.Random(1881)
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    for index in range(9):
        x = 70 + ((rng.randint(0, 850) + phase * (115 + index * 7)) % 900)
        y = rng.randint(770, 1080) + math.sin(phase * math.tau + index) * 18
        width = rng.randint(120, 240)
        height = rng.randint(18, 42)
        pulse = 0.45 + 0.3 * math.sin(phase * math.tau + index * 0.61) ** 2
        draw.ellipse((x - width, y - height, x + width, y + height), fill=(round(20 * pulse), round(65 * pulse), round(92 * pulse)))
    return layer.filter(ImageFilter.GaussianBlur(34))


def frost_pulse(size: tuple[int, int], phase: float) -> Image.Image:
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    pulse = 0.42 + 0.28 * math.sin(phase * math.tau) ** 2
    cyan = (round(35 * pulse), round(145 * pulse), round(225 * pulse))
    for width, alpha in ((13, 1.0), (28, 0.45)):
        color = tuple(round(channel * alpha) for channel in cyan)
        draw.rounded_rectangle((15, 15, size[0] - 16, size[1] - 16), radius=28, outline=color, width=width)
    for center in ((130, 135), (900, 135), (130, 1390), (900, 1390)):
        radius = 30 + round(7 * math.sin(phase * math.tau + center[0]) ** 2)
        draw.ellipse((center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius), fill=cyan)
    return layer.filter(ImageFilter.GaussianBlur(12))


def foil_sweep(master: Image.Image, phase: float) -> Image.Image:
    size = master.size
    beam = Image.new("L", size, 0)
    draw = ImageDraw.Draw(beam)
    travel = -480 + phase * 2050
    draw.polygon([(travel, 1550), (travel + 95, 1550), (travel + 590, -20), (travel + 495, -20)], fill=220)
    beam = beam.filter(ImageFilter.GaussianBlur(20))

    luminance = ImageOps.grayscale(master)
    detail = luminance.point(lambda value: max(0, min(255, (value - 105) * 2)))
    mask = ImageChops.multiply(beam, detail)
    layer = Image.new("RGB", size, (80, 205, 255))
    return Image.composite(layer, Image.new("RGB", size, "black"), mask)


def title_glint(size: tuple[int, int], phase: float) -> Image.Image:
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    x = 190 + phase * 650
    draw.polygon([(x - 55, 1160), (x + 10, 1160), (x + 80, 1300), (x + 15, 1300)], fill=(95, 205, 255))
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((185, 1150, 845, 1308), radius=30, fill=255)
    return Image.composite(layer.filter(ImageFilter.GaussianBlur(11)), Image.new("RGB", size, "black"), mask)


def render(master: Image.Image, phase: float) -> Image.Image:
    frame = camera(master, phase)
    frozen_shiver(frame, phase)
    screen(frame, cold_mist(frame.size, phase), 0.56)
    screen(frame, crystal_energy(frame.size, phase), 0.92)
    for depth in range(3):
        screen(frame, snow(frame.size, phase, depth), 0.82)
    screen(frame, foil_sweep(master, phase), 0.34)
    screen(frame, frost_pulse(frame.size, phase), 0.64)
    screen(frame, title_glint(frame.size, phase), 0.42)

    # A gentle cold-light heartbeat keeps both spell seals alive without rotating UI.
    pulse = 0.5 + 0.5 * math.sin(phase * math.tau) ** 2
    glow = Image.new("RGB", frame.size, "black")
    draw = ImageDraw.Draw(glow)
    for x, y, radius in ((130, 135, 78), (900, 135, 70), (132, 1390, 72), (893, 1392, 66)):
        color = (round(25 * pulse), round(115 * pulse), round(200 * pulse))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
    screen(frame, glow.filter(ImageFilter.GaussianBlur(34)), 0.42)
    return ImageEnhance.Contrast(frame).enhance(1.015)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--master", required=True, type=Path)
    parser.add_argument("--webp", required=True, type=Path)
    parser.add_argument("--gif", required=True, type=Path)
    parser.add_argument("--sheet", required=True, type=Path)
    parser.add_argument("--frames", type=int, default=48)
    args = parser.parse_args()

    master = Image.open(args.master).convert("RGB")
    web_frames: list[Image.Image] = []
    runtime_frames: list[Image.Image] = []
    for index in range(args.frames):
        frame = render(master, index / args.frames)
        web_frames.append(frame.resize((512, 768), Image.Resampling.LANCZOS))
        runtime_frames.append(frame.resize((384, 576), Image.Resampling.LANCZOS))

    duration = round(4000 / args.frames)
    args.webp.parent.mkdir(parents=True, exist_ok=True)
    # Crystal-heavy artwork is expensive for WebP's highest search modes. Method 3
    # preserves the full 48-frame cadence without multi-gigabyte encoder spikes.
    web_frames[0].save(args.webp, save_all=True, append_images=web_frames[1:], duration=duration, loop=0, quality=84, method=3)
    runtime_frames[0].save(args.gif, save_all=True, append_images=runtime_frames[1:], duration=duration, loop=0, optimize=True, disposal=2)

    sheet = Image.new("RGB", (384 * 8, 576 * 6), "black")
    for index, frame in enumerate(runtime_frames):
        sheet.paste(frame, ((index % 8) * 384, (index // 8) * 576))
    sheet.save(args.sheet, format="WEBP", quality=84, method=4)


if __name__ == "__main__":
    main()
