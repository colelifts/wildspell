"""Create a seamless cinematic Arcane +2 loop from the final supplied master."""

from __future__ import annotations

import argparse
import math
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps


ART_BOX = (42, 48, 982, 1156)


def screen(base: Image.Image, layer: Image.Image, amount: float = 1.0) -> None:
    mixed = ImageChops.screen(base.convert("RGB"), layer.convert("RGB"))
    base.paste(mixed if amount >= 1 else Image.blend(base, mixed, amount))


def camera(master: Image.Image, phase: float) -> Image.Image:
    frame = master.copy()
    art = master.crop(ART_BOX)
    ease = 0.5 - 0.5 * math.cos(phase * math.tau)
    zoom = 1.002 + 0.004 * ease
    width, height = round(art.width * zoom), round(art.height * zoom)
    enlarged = art.resize((width, height), Image.Resampling.BICUBIC)
    drift_x = round(math.sin(phase * math.tau) * 1.2)
    drift_y = round(math.cos(phase * math.tau) * 1.0)
    left = (width - art.width) // 2 + drift_x
    top = (height - art.height) // 2 + drift_y
    frame.paste(enlarged.crop((left, top, left + art.width, top + art.height)), ART_BOX[:2])
    return frame


def energy_refraction(frame: Image.Image, phase: float) -> None:
    source = frame.crop(ART_BOX)
    warped = Image.new("RGB", source.size, "black")
    for y in range(0, source.height, 9):
        strength = 0.55 + 1.35 * math.sin(math.pi * y / source.height) ** 2
        shift = round(math.sin(phase * math.tau + y * 0.028) * strength)
        band = source.crop((0, y, source.width, min(y + 9, source.height)))
        warped.paste(band, (shift, y))
    frame.paste(warped, ART_BOX[:2])


def arcane_ribbons(size: tuple[int, int], phase: float) -> Image.Image:
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    center = (520, 640)
    colors = ((70, 25, 180), (135, 55, 255), (220, 170, 255))
    for index in range(15):
        radius_x = 150 + index * 30
        radius_y = 95 + index * 22
        direction = 1 if index % 2 == 0 else -1
        angle = phase * 360 * direction * (0.75 + (index % 4) * 0.08) + index * 37
        span = 38 + (index % 5) * 9
        box = (center[0] - radius_x, center[1] - radius_y, center[0] + radius_x, center[1] + radius_y)
        draw.arc(box, start=angle, end=angle + span, fill=colors[index % 3], width=2 + index % 3)
        draw.arc(box, start=angle + 180, end=angle + 180 + span * 0.7, fill=colors[(index + 1) % 3], width=1 + index % 2)
    return layer.filter(ImageFilter.GaussianBlur(2.7))


def hand_charge(size: tuple[int, int], phase: float) -> Image.Image:
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    pulse = 0.46 + 0.54 * math.sin(phase * math.tau) ** 2
    for x, y, radius, strength in ((610, 790, 145, 1.0), (490, 590, 96, 0.66), (515, 445, 72, 0.42)):
        color = (round(68 * pulse * strength), round(18 * pulse * strength), round(185 * pulse * strength))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
    return layer.filter(ImageFilter.GaussianBlur(48))


def card_aura(size: tuple[int, int], phase: float) -> Image.Image:
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    cards = ((250, 845, 105, 0.0), (675, 1070, 115, math.pi))
    for x, y, radius, offset in cards:
        pulse = 0.42 + 0.58 * math.sin(phase * math.tau + offset) ** 2
        color = (round(80 * pulse), round(25 * pulse), round(210 * pulse))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
        for ring in range(3):
            ring_radius = radius + 12 + ring * 13
            start = phase * 360 * (1 if ring % 2 == 0 else -1) + ring * 83
            draw.arc((x - ring_radius, y - ring_radius * 0.7, x + ring_radius, y + ring_radius * 0.7), start=start, end=start + 58, fill=(110, 55, 225), width=3)
    return layer.filter(ImageFilter.GaussianBlur(17))


def orbiting_shards(size: tuple[int, int], phase: float, depth: int) -> Image.Image:
    rng = random.Random(5561 + depth)
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    count = (22, 14, 8)[depth]
    center_x, center_y = 520, 630
    for index in range(count):
        angle = rng.random() * math.tau + phase * math.tau * (0.55 + depth * 0.2)
        radius = rng.randint(150, 500)
        x = center_x + math.cos(angle) * radius
        y = center_y + math.sin(angle) * radius * 0.78
        length = 3 + depth * 3 + rng.random() * 4
        width = 1.5 + depth
        tangent = angle + math.pi / 2
        p1 = (x + math.cos(tangent) * length, y + math.sin(tangent) * length)
        p2 = (x - math.sin(tangent) * width, y + math.cos(tangent) * width)
        p3 = (x - math.cos(tangent) * length, y - math.sin(tangent) * length)
        p4 = (x + math.sin(tangent) * width, y - math.cos(tangent) * width)
        glint = 0.4 + 0.6 * math.sin(angle * 2 + index) ** 2
        color = (round(105 * glint), round(50 * glint), round(255 * glint))
        draw.polygon((p1, p2, p3, p4), fill=color)
    return layer.filter(ImageFilter.GaussianBlur(0.35 + depth * 0.5))


def cosmic_particles(size: tuple[int, int], phase: float, depth: int) -> Image.Image:
    rng = random.Random(9103 + depth)
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    count = (48, 30, 17)[depth]
    speed = (110, 180, 270)[depth]
    for index in range(count):
        x0 = rng.randint(60, size[0] - 60)
        y0 = rng.randint(70, 1140)
        y = 70 + ((y0 - 70 - phase * speed) % 1070)
        x = x0 + math.sin(phase * math.tau + index * 0.89) * (5 + depth * 9)
        twinkle = 0.3 + 0.7 * math.sin(phase * math.tau + index * 0.73) ** 2
        radius = 1 + depth + rng.choice((0, 0, 1))
        color = (round(100 * twinkle), round(50 * twinkle), round(255 * twinkle))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
    return layer.filter(ImageFilter.GaussianBlur(0.3 + depth * 0.5))


def blindfold_glint(size: tuple[int, int], phase: float) -> Image.Image:
    layer = Image.new("RGB", size, "black")
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).polygon(((430, 365), (652, 372), (635, 475), (445, 470)), fill=255)
    travel = 405 + phase * 280
    draw = ImageDraw.Draw(layer)
    draw.polygon(((travel - 24, 340), (travel + 9, 340), (travel + 50, 505), (travel + 17, 505)), fill=(120, 70, 255))
    return Image.composite(layer.filter(ImageFilter.GaussianBlur(8)), Image.new("RGB", size, "black"), mask.filter(ImageFilter.GaussianBlur(5)))


def emblem_pulse(size: tuple[int, int], phase: float) -> Image.Image:
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    pulse = 0.45 + 0.55 * math.sin(phase * math.tau) ** 2
    for x, y, radius, strength in ((132, 146, 92, 1.0), (900, 1410, 68, 0.72), (510, 1325, 28, 0.52)):
        color = (round(70 * pulse * strength), round(25 * pulse * strength), round(190 * pulse * strength))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
    return layer.filter(ImageFilter.GaussianBlur(35))


def foil_sweep(master: Image.Image, phase: float) -> Image.Image:
    beam = Image.new("L", master.size, 0)
    travel = -450 + phase * 1980
    ImageDraw.Draw(beam).polygon(((travel, 1555), (travel + 92, 1555), (travel + 575, -20), (travel + 483, -20)), fill=215)
    beam = beam.filter(ImageFilter.GaussianBlur(20))
    detail = ImageOps.grayscale(master).point(lambda value: max(0, min(255, (value - 105) * 2)))
    mask = ImageChops.multiply(beam, detail)
    return Image.composite(Image.new("RGB", master.size, (135, 75, 255)), Image.new("RGB", master.size, "black"), mask)


def title_glint(size: tuple[int, int], phase: float) -> Image.Image:
    layer = Image.new("RGB", size, "black")
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((105, 1150, 920, 1325), radius=34, fill=255)
    x = 130 + phase * 820
    ImageDraw.Draw(layer).polygon(((x - 45, 1140), (x + 10, 1140), (x + 80, 1340), (x + 25, 1340)), fill=(115, 65, 255))
    return Image.composite(layer.filter(ImageFilter.GaussianBlur(10)), Image.new("RGB", size, "black"), mask)


def render(master: Image.Image, phase: float) -> Image.Image:
    frame = camera(master, phase)
    energy_refraction(frame, phase)
    screen(frame, hand_charge(frame.size, phase), 0.58)
    screen(frame, card_aura(frame.size, phase), 0.58)
    screen(frame, arcane_ribbons(frame.size, phase), 0.65)
    for depth in range(3):
        screen(frame, orbiting_shards(frame.size, phase, depth), 0.78)
        screen(frame, cosmic_particles(frame.size, phase, depth), 0.75)
    screen(frame, blindfold_glint(frame.size, phase), 0.64)
    screen(frame, emblem_pulse(frame.size, phase), 0.42)
    screen(frame, foil_sweep(master, phase), 0.33)
    screen(frame, title_glint(frame.size, phase), 0.40)
    return ImageEnhance.Contrast(frame).enhance(1.012)


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
    web_frames[0].save(args.webp, save_all=True, append_images=web_frames[1:], duration=duration, loop=0, quality=84, method=3)
    runtime_frames[0].save(args.gif, save_all=True, append_images=runtime_frames[1:], duration=duration, loop=0, optimize=True, disposal=2)
    sheet = Image.new("RGB", (384 * 8, 576 * 6), "black")
    for index, frame in enumerate(runtime_frames):
        sheet.paste(frame, ((index % 8) * 384, (index // 8) * 576))
    sheet.save(args.sheet, format="WEBP", quality=84, method=4)


if __name__ == "__main__":
    main()
