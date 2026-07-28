"""Create a seamless cinematic Chaos +4 loop from the supplied master."""

from __future__ import annotations

import argparse
import math
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps


ART_BOX = (43, 48, 981, 1043)


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
    drift_x = round(math.sin(phase * math.tau) * 1.25)
    drift_y = round(math.cos(phase * math.tau) * 1.0)
    left = (width - art.width) // 2 + drift_x
    top = (height - art.height) // 2 + drift_y
    frame.paste(enlarged.crop((left, top, left + art.width, top + art.height)), ART_BOX[:2])
    return frame


def throne_breathe(frame: Image.Image, phase: float) -> None:
    source = frame.crop(ART_BOX)
    warped = Image.new("RGB", source.size, "black")
    for y in range(0, source.height, 10):
        strength = 0.5 + 1.45 * math.sin(math.pi * y / source.height) ** 2
        shift = round(math.sin(phase * math.tau + y * 0.024) * strength)
        band = source.crop((0, y, source.width, min(y + 10, source.height)))
        warped.paste(band, (shift, y))
    frame.paste(warped, ART_BOX[:2])


def blood_aura(size: tuple[int, int], phase: float) -> Image.Image:
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    pulse = 0.42 + 0.58 * math.sin(phase * math.tau) ** 2
    for x, y, radius, strength in ((515, 410, 290, 0.75), (520, 575, 210, 1.0), (510, 180, 170, 0.55)):
        color = (round(155 * pulse * strength), round(10 * pulse * strength), round(6 * pulse * strength))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
    return layer.filter(ImageFilter.GaussianBlur(72))


def chaos_card(phase: float, variant: int) -> Image.Image:
    width, height = 112, 166
    sprite = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(sprite)
    pulse = 0.7 + 0.3 * math.sin(phase * math.tau + variant * math.pi / 2) ** 2
    red = (round(245 * pulse), round(35 * pulse), round(22 * pulse), 255)
    ember = (round(255 * pulse), round(120 * pulse), round(50 * pulse), 255)
    draw.rounded_rectangle((6, 6, width - 7, height - 7), radius=13, fill=(12, 1, 2, 218), outline=red, width=7)
    draw.rounded_rectangle((15, 15, width - 16, height - 16), radius=9, outline=ember, width=2)
    cx, cy = width // 2, 75
    for spoke in range(8):
        angle = spoke * math.tau / 8 + phase * math.tau * (1 if variant % 2 == 0 else -1)
        draw.line((cx, cy, cx + math.cos(angle) * 31, cy + math.sin(angle) * 31), fill=red, width=3)
    draw.ellipse((cx - 13, cy - 13, cx + 13, cy + 13), outline=ember, width=3)
    draw.line((30, 125, 82, 125), fill=red, width=3)
    draw.line((40, 139, 72, 139), fill=ember, width=2)
    return sprite


def four_cards(size: tuple[int, int], phase: float) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    center_x, center_y = 520, 560
    for index in range(4):
        angle = phase * math.tau * (0.72 if index % 2 == 0 else -0.72) + index * math.pi / 2
        radius_x = 330 + 18 * math.sin(phase * math.tau + index)
        radius_y = 285 + 12 * math.cos(phase * math.tau + index)
        x = center_x + math.cos(angle) * radius_x
        y = center_y + math.sin(angle) * radius_y
        rotation = math.degrees(angle) + 90 + math.sin(phase * math.tau + index) * 5
        card = chaos_card(phase, index).rotate(rotation, resample=Image.Resampling.BICUBIC, expand=True)
        layer.alpha_composite(card, (round(x - card.width / 2), round(y - card.height / 2)))
    return layer


def blood_lightning(size: tuple[int, int], phase: float) -> Image.Image:
    rng = random.Random(round(phase * 48) // 3 + 4100)
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    flash = max(0.0, math.sin(phase * math.tau * 2.0 + 0.8)) ** 14
    if flash <= 0.02:
        return layer
    for bolt in range(3):
        x = rng.randint(190, 840)
        y = rng.randint(80, 220)
        points = [(x, y)]
        for step in range(6):
            x += rng.randint(-45, 45)
            y += rng.randint(55, 105)
            points.append((x, y))
        core = (round(255 * flash), round(125 * flash), round(75 * flash))
        red = (round(230 * flash), round(28 * flash), round(12 * flash))
        draw.line(points, fill=red, width=8)
        draw.line(points, fill=core, width=2)
    return layer.filter(ImageFilter.GaussianBlur(2.2))


def rising_embers(size: tuple[int, int], phase: float, depth: int) -> Image.Image:
    rng = random.Random(7731 + depth)
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    count = (44, 28, 15)[depth]
    speed = (125, 205, 305)[depth]
    for index in range(count):
        x0 = rng.randint(65, size[0] - 65)
        y0 = rng.randint(75, 1035)
        y = 75 + ((y0 - 75 - phase * speed) % 960)
        x = x0 + math.sin(phase * math.tau + index * 0.91) * (5 + depth * 9)
        flicker = 0.35 + 0.65 * math.sin(phase * math.tau + index * 0.79) ** 2
        radius = 1 + depth + rng.choice((0, 0, 1))
        color = (round(255 * flicker), round(62 * flicker), round(18 * flicker))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
    return layer.filter(ImageFilter.GaussianBlur(0.3 + depth * 0.5))


def black_smoke(size: tuple[int, int], phase: float) -> Image.Image:
    rng = random.Random(6690)
    overlay = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for index in range(12):
        x = 40 + ((rng.randint(0, 930) + phase * (55 + index * 4)) % 940)
        y = rng.randint(230, 1000) + math.sin(phase * math.tau + index) * 18
        radius_x = rng.randint(65, 150)
        radius_y = rng.randint(22, 55)
        alpha = round(35 + 24 * math.sin(phase * math.tau + index * 0.67) ** 2)
        draw.ellipse((x - radius_x, y - radius_y, x + radius_x, y + radius_y), fill=(0, 0, 0, alpha))
    return overlay.filter(ImageFilter.GaussianBlur(31))


def eye_glow(size: tuple[int, int], phase: float) -> Image.Image:
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    pulse = 0.38 + 0.62 * math.sin(phase * math.tau) ** 2
    for x, y in ((462, 468), (544, 463)):
        radius = 8 + 4 * pulse
        color = (round(255 * pulse), round(55 * pulse), round(30 * pulse))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
    return layer.filter(ImageFilter.GaussianBlur(7))


def sequential_seals(size: tuple[int, int], phase: float) -> Image.Image:
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    seals = ((126, 135, 84), (897, 137, 84), (126, 1405, 76), (900, 1405, 76))
    for index, (x, y, radius) in enumerate(seals):
        local = ((phase * 4) - index) % 4
        pulse = math.exp(-((local - 0.18) ** 2) / 0.12) + 0.22
        color = (min(255, round(145 * pulse)), min(255, round(24 * pulse)), min(255, round(14 * pulse)))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
    return layer.filter(ImageFilter.GaussianBlur(34))


def foil_sweep(master: Image.Image, phase: float) -> Image.Image:
    beam = Image.new("L", master.size, 0)
    travel = -450 + phase * 1980
    ImageDraw.Draw(beam).polygon(((travel, 1555), (travel + 92, 1555), (travel + 575, -20), (travel + 483, -20)), fill=215)
    beam = beam.filter(ImageFilter.GaussianBlur(20))
    detail = ImageOps.grayscale(master).point(lambda value: max(0, min(255, (value - 98) * 2)))
    mask = ImageChops.multiply(beam, detail)
    return Image.composite(Image.new("RGB", master.size, (255, 60, 32)), Image.new("RGB", master.size, "black"), mask)


def title_glint(size: tuple[int, int], phase: float) -> Image.Image:
    layer = Image.new("RGB", size, "black")
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((110, 1035, 910, 1195), radius=32, fill=255)
    x = 125 + phase * 830
    ImageDraw.Draw(layer).polygon(((x - 45, 1020), (x + 10, 1020), (x + 78, 1210), (x + 23, 1210)), fill=(255, 75, 35))
    return Image.composite(layer.filter(ImageFilter.GaussianBlur(10)), Image.new("RGB", size, "black"), mask)


def render(master: Image.Image, phase: float) -> Image.Image:
    frame = camera(master, phase)
    throne_breathe(frame, phase)
    screen(frame, blood_aura(frame.size, phase), 0.48)
    frame = Image.alpha_composite(frame.convert("RGBA"), black_smoke(frame.size, phase)).convert("RGB")
    frame = Image.alpha_composite(frame.convert("RGBA"), four_cards(frame.size, phase)).convert("RGB")
    for depth in range(3):
        screen(frame, rising_embers(frame.size, phase, depth), 0.78)
    screen(frame, blood_lightning(frame.size, phase), 0.78)
    screen(frame, eye_glow(frame.size, phase), 0.72)
    screen(frame, sequential_seals(frame.size, phase), 0.42)
    screen(frame, foil_sweep(master, phase), 0.32)
    screen(frame, title_glint(frame.size, phase), 0.42)
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
    web_frames[0].save(args.webp, save_all=True, append_images=web_frames[1:], duration=duration, loop=0, quality=84, method=3)
    runtime_frames[0].save(args.gif, save_all=True, append_images=runtime_frames[1:], duration=duration, loop=0, optimize=True, disposal=2)
    sheet = Image.new("RGB", (384 * 8, 576 * 6), "black")
    for index, frame in enumerate(runtime_frames):
        sheet.paste(frame, ((index % 8) * 384, (index // 8) * 576))
    sheet.save(args.sheet, format="WEBP", quality=84, method=4)


if __name__ == "__main__":
    main()
