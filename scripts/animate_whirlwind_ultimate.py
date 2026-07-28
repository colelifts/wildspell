"""Create a seamless cinematic Whirlwind card loop from the supplied master."""

from __future__ import annotations

import argparse
import math
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps


ART_BOX = (44, 48, 980, 1086)


def screen(base: Image.Image, layer: Image.Image, amount: float = 1.0) -> None:
    mixed = ImageChops.screen(base.convert("RGB"), layer.convert("RGB"))
    base.paste(mixed if amount >= 1 else Image.blend(base, mixed, amount))


def camera(master: Image.Image, phase: float) -> Image.Image:
    frame = master.copy()
    art = master.crop(ART_BOX)
    ease = 0.5 - 0.5 * math.cos(phase * math.tau)
    zoom = 1.002 + 0.0045 * ease
    width, height = round(art.width * zoom), round(art.height * zoom)
    enlarged = art.resize((width, height), Image.Resampling.BICUBIC)
    drift_x = round(math.sin(phase * math.tau) * 1.7)
    drift_y = round(math.cos(phase * math.tau) * 1.2)
    left = (width - art.width) // 2 + drift_x
    top = (height - art.height) // 2 + drift_y
    frame.paste(enlarged.crop((left, top, left + art.width, top + art.height)), ART_BOX[:2])
    return frame


def gust_warp(frame: Image.Image, phase: float) -> None:
    """Subtle cyclic refraction makes the painted vortex itself feel in motion."""
    source = frame.crop(ART_BOX)
    warped = Image.new("RGB", source.size, "black")
    for y in range(0, source.height, 10):
        strength = 0.6 + 1.5 * math.sin(math.pi * y / source.height) ** 2
        shift = round(math.sin(phase * math.tau + y * 0.025) * strength)
        band = source.crop((0, y, source.width, min(y + 10, source.height)))
        warped.paste(band, (shift, y))
    frame.paste(warped, ART_BOX[:2])


def vortex_ribbons(size: tuple[int, int], phase: float) -> Image.Image:
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    center = (516, 515)
    palettes = ((42, 155, 162), (88, 220, 221), (178, 251, 245))
    for index in range(13):
        radius_x = 175 + index * 30
        radius_y = 95 + index * 20
        angle = phase * 360 * (1.0 + (index % 3) * 0.12) + index * 41
        span = 42 + (index % 4) * 11
        box = (center[0] - radius_x, center[1] - radius_y, center[0] + radius_x, center[1] + radius_y)
        color = palettes[index % len(palettes)]
        draw.arc(box, start=angle, end=angle + span, fill=color, width=2 + index % 3)
        draw.arc(box, start=angle + 180, end=angle + 180 + span * 0.65, fill=color, width=1 + index % 2)
    return layer.filter(ImageFilter.GaussianBlur(2.2))


def spiral_streaks(size: tuple[int, int], phase: float, depth: int) -> Image.Image:
    rng = random.Random(4921 + depth)
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    center_x, center_y = 520, 520
    count = (28, 18, 10)[depth]
    for index in range(count):
        base_angle = rng.random() * math.tau + phase * math.tau * (0.75 + depth * 0.22)
        radius = rng.randint(110, 500)
        squash = 0.58 + rng.random() * 0.18
        points = []
        for step in range(9):
            angle = base_angle - step * (0.025 + depth * 0.008)
            r = radius - step * (2 + depth)
            points.append((center_x + math.cos(angle) * r, center_y + math.sin(angle) * r * squash))
        intensity = 0.45 + 0.5 * math.sin(phase * math.tau + index * 0.81) ** 2
        color = (round(50 * intensity), round(205 * intensity), round(210 * intensity))
        draw.line(points, fill=color, width=1 + depth)
    return layer.filter(ImageFilter.GaussianBlur(0.5 + depth * 0.55))


def orbiting_debris(size: tuple[int, int], phase: float, depth: int) -> Image.Image:
    rng = random.Random(8227 + depth)
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    count = (18, 12, 7)[depth]
    center_x, center_y = 520, 520
    for index in range(count):
        angle = rng.random() * math.tau + phase * math.tau * (0.62 + depth * 0.22)
        radius = rng.randint(150, 500)
        x = center_x + math.cos(angle) * radius
        y = center_y + math.sin(angle) * radius * 0.62
        rock = 1.5 + depth * 1.8 + rng.random() * 2.5
        glint = 0.35 + 0.65 * math.sin(angle * 2 + index) ** 2
        color = (round(55 * glint), round(125 * glint), round(130 * glint))
        points = []
        for corner in range(5):
            theta = angle + corner * math.tau / 5
            points.append((x + math.cos(theta) * rock, y + math.sin(theta) * rock * 0.72))
        draw.polygon(points, fill=color)
    return layer.filter(ImageFilter.GaussianBlur(0.25 + depth * 0.4))


def card_exchange_energy(size: tuple[int, int], phase: float) -> Image.Image:
    """Two counter-moving pulses visualize the random card swap."""
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    center_x, center_y = 545, 515
    for direction, offset in ((1, 0.0), (-1, 0.5)):
        t = (phase * direction + offset) % 1.0
        angle = t * math.tau - 0.75
        radius_x, radius_y = 285, 250
        x = center_x + math.cos(angle) * radius_x
        y = center_y + math.sin(angle) * radius_y
        for radius, color in ((24, (12, 68, 68)), (12, (50, 170, 170)), (4, (185, 255, 245))):
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
        # Short luminous tail in the opposite direction of travel.
        tail_x = x - math.sin(angle) * 58 * direction
        tail_y = y + math.cos(angle) * 36 * direction
        draw.line((x, y, tail_x, tail_y), fill=(70, 220, 210), width=5)
    return layer.filter(ImageFilter.GaussianBlur(7))


def card_glints(size: tuple[int, int], phase: float) -> Image.Image:
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    pulse_a = 0.35 + 0.65 * math.sin(phase * math.tau) ** 2
    pulse_b = 0.35 + 0.65 * math.sin(phase * math.tau + math.pi / 2) ** 2
    for (x, y, radius), pulse in (((450, 286, 88), pulse_a), ((728, 748, 90), pulse_b)):
        color = (round(20 * pulse), round(120 * pulse), round(125 * pulse))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
    return layer.filter(ImageFilter.GaussianBlur(34))


def foil_sweep(master: Image.Image, phase: float) -> Image.Image:
    beam = Image.new("L", master.size, 0)
    draw = ImageDraw.Draw(beam)
    travel = -470 + phase * 1980
    draw.polygon([(travel, 1550), (travel + 95, 1550), (travel + 585, -20), (travel + 490, -20)], fill=210)
    beam = beam.filter(ImageFilter.GaussianBlur(21))
    detail = ImageOps.grayscale(master).point(lambda value: max(0, min(255, (value - 100) * 2)))
    mask = ImageChops.multiply(beam, detail)
    teal = Image.new("RGB", master.size, (75, 215, 205))
    return Image.composite(teal, Image.new("RGB", master.size, "black"), mask)


def border_and_title_glint(size: tuple[int, int], phase: float) -> Image.Image:
    layer = Image.new("RGB", size, "black")
    mask = Image.new("L", size, 0)
    md = ImageDraw.Draw(mask)
    md.rectangle((8, 8, 1015, 62), fill=255)
    md.rectangle((8, 1472, 1015, 1527), fill=255)
    md.rectangle((8, 8, 58, 1527), fill=255)
    md.rectangle((966, 8, 1015, 1527), fill=255)
    md.rounded_rectangle((135, 1080, 890, 1250), radius=34, outline=220, width=15)
    travel = -360 + phase * 1760
    draw = ImageDraw.Draw(layer)
    draw.line((travel, 1550, travel + 460, -20), fill=(95, 250, 235), width=20)
    draw.line((travel + 28, 1550, travel + 488, -20), fill=(220, 255, 250), width=4)
    return Image.composite(layer.filter(ImageFilter.GaussianBlur(6)), Image.new("RGB", size, "black"), mask.filter(ImageFilter.GaussianBlur(2)))


def seal_heartbeat(size: tuple[int, int], phase: float) -> Image.Image:
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    pulse = 0.45 + 0.55 * math.sin(phase * math.tau) ** 2
    for x, y, radius in ((132, 135, 78), (900, 135, 70), (132, 1390, 72), (895, 1395, 62)):
        color = (round(20 * pulse), round(115 * pulse), round(110 * pulse))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
    return layer.filter(ImageFilter.GaussianBlur(33))


def render(master: Image.Image, phase: float) -> Image.Image:
    frame = camera(master, phase)
    gust_warp(frame, phase)
    screen(frame, card_glints(frame.size, phase), 0.44)
    screen(frame, vortex_ribbons(frame.size, phase), 0.58)
    for depth in range(3):
        screen(frame, spiral_streaks(frame.size, phase, depth), 0.72)
        screen(frame, orbiting_debris(frame.size, phase, depth), 0.72)
    screen(frame, card_exchange_energy(frame.size, phase), 0.82)
    screen(frame, foil_sweep(master, phase), 0.31)
    screen(frame, border_and_title_glint(frame.size, phase), 0.65)
    screen(frame, seal_heartbeat(frame.size, phase), 0.38)
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
