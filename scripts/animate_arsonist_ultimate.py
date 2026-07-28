"""Create the layered, cinematic Arsonist card loop from an immutable master."""

from __future__ import annotations

import argparse
import math
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter


def cells(sheet: Image.Image) -> list[Image.Image]:
    width, height = sheet.width // 4, sheet.height // 2
    return [sheet.crop((x * width, y * height, (x + 1) * width, (y + 1) * height)) for y in range(2) for x in range(4)]


def loop_frame(items: list[Image.Image], phase: float) -> Image.Image:
    position = phase * len(items)
    index = int(position) % len(items)
    blend = position - math.floor(position)
    blend = blend * blend * (3 - 2 * blend)
    return Image.blend(items[index], items[(index + 1) % len(items)], blend)


def screen(base: Image.Image, layer: Image.Image, xy: tuple[int, int] = (0, 0), amount: float = 1) -> None:
    x, y = xy
    target = base.crop((x, y, x + layer.width, y + layer.height)).convert("RGB")
    mixed = ImageChops.screen(target, layer.convert("RGB"))
    if amount < 1:
        mixed = Image.blend(target, mixed, amount)
    base.paste(mixed, (x, y))


def feathered_paste(base: Image.Image, source: Image.Image, box: tuple[int, int, int, int], feather: int = 18) -> None:
    left, top, right, bottom = box
    mask = Image.new("L", (right - left, bottom - top), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((feather, feather, mask.width - feather, mask.height - feather), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(feather))
    base.paste(source, (left, top), mask)


def art_camera(master: Image.Image, phase: float) -> Image.Image:
    frame = master.copy()
    box = (52, 52, 972, 1128)
    art = master.crop(box)
    zoom = 1.0025 + 0.0025 * (0.5 + 0.5 * math.sin(phase * math.tau - math.pi / 2))
    resized = art.resize((round(art.width * zoom), round(art.height * zoom)), Image.Resampling.BICUBIC)
    left = (resized.width - art.width) // 2
    top = (resized.height - art.height) // 2
    frame.paste(resized.crop((left, top, left + art.width, top + art.height)), box[:2])
    return frame


def heat_shimmer(frame: Image.Image, phase: float) -> None:
    box = (355, 55, 670, 330)
    source = frame.crop(box)
    for y in range(0, source.height, 10):
        shift = round(math.sin(phase * math.tau + y * 0.11) * 2.4)
        band = source.crop((0, y, source.width, min(source.height, y + 10)))
        frame.paste(band, (box[0] + shift, box[1] + y))


def breathing(frame: Image.Image, master: Image.Image, phase: float) -> None:
    box = (250, 285, 930, 1010)
    source = master.crop(box)
    breath = 0.5 + 0.5 * math.sin(phase * math.tau - math.pi / 2)
    height = source.height + round(4 * breath)
    moved = source.resize((source.width, height), Image.Resampling.BICUBIC).crop((0, 0, source.width, source.height))
    feathered_paste(frame, moved, box, 48)


def hand_float(frame: Image.Image, master: Image.Image, phase: float) -> None:
    box = (65, 650, 590, 1115)
    source = master.crop(box)
    shift_y = round(math.sin(phase * math.tau) * 2.2)
    canvas = Image.new("RGB", source.size, "black")
    canvas.paste(source, (0, shift_y))
    feathered_paste(frame, canvas, box, 42)


def scarf_ripple(frame: Image.Image, phase: float) -> None:
    box = (275, 345, 925, 765)
    source = frame.crop(box)
    mask = Image.new("L", source.size, 0)
    ImageDraw.Draw(mask).ellipse((10, 10, source.width - 10, source.height - 10), fill=178)
    mask = mask.filter(ImageFilter.GaussianBlur(38))
    warped = Image.new("RGB", source.size, "black")
    for y in range(0, source.height, 12):
        shift = round(math.sin(phase * math.tau + y * 0.035) * 1.7)
        warped.paste(source.crop((0, y, source.width, min(source.height, y + 12))), (shift, y))
    frame.paste(warped, box[:2], mask)


def eye_animation(frame: Image.Image, master: Image.Image, phase: float) -> None:
    box = (440, 482, 586, 555)
    source = master.crop(box)
    distance = min(abs(phase - 0.56), abs(phase - 1.56), abs(phase + 0.44))
    blink = max(0.0, 1.0 - distance / 0.045)
    visible_height = max(4, round(source.height * (1 - blink * 0.9)))
    eye = source.resize((source.width, visible_height), Image.Resampling.BICUBIC)
    canvas = source.copy()
    canvas.paste(eye, (0, (source.height - visible_height) // 2))
    feathered_paste(frame, canvas, box, 12)


def radial_glow(size: tuple[int, int], center: tuple[int, int], radius: int, strength: float) -> Image.Image:
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    cx, cy = center
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=(round(185 * strength), round(54 * strength), round(5 * strength)))
    return layer.filter(ImageFilter.GaussianBlur(radius * 0.48))


def embers(size: tuple[int, int], phase: float, depth: int) -> Image.Image:
    randomizer = random.Random(9000 + depth)
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    count = (52, 34, 18)[depth]
    speed = (185, 285, 410)[depth]
    for index in range(count):
        start_x = randomizer.randint(70, size[0] - 70)
        start_y = randomizer.randint(80, 1110)
        y = 80 + ((start_y - 80 - phase * speed) % 1030)
        x = start_x + math.sin(phase * math.tau + index * 1.31) * (8 + depth * 11)
        pulse = 0.36 + 0.64 * math.sin(phase * math.tau + index * 0.77) ** 2
        radius = depth + randomizer.choice((1, 1, 2))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(round(255 * pulse), round(95 * pulse), round(8 * pulse)))
    return layer.filter(ImageFilter.GaussianBlur(0.45 + depth * 0.45))


def border_glint(size: tuple[int, int], phase: float) -> Image.Image:
    layer = Image.new("RGB", size, "black")
    mask = Image.new("L", size, 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rectangle((8, 8, 1015, 64), fill=255)
    mask_draw.rectangle((8, 1465, 1015, 1527), fill=255)
    mask_draw.rectangle((8, 8, 60, 1527), fill=255)
    mask_draw.rectangle((963, 8, 1015, 1527), fill=255)
    mask_draw.rounded_rectangle((100, 1120, 925, 1285), radius=38, outline=190, width=13)
    mask = mask.filter(ImageFilter.GaussianBlur(2))
    draw = ImageDraw.Draw(layer)
    travel = -300 + phase * 1650
    draw.line((travel, 1540, travel + 430, -20), fill=(255, 190, 74), width=24)
    draw.line((travel + 40, 1540, travel + 470, -20), fill=(255, 248, 205), width=5)
    layer = layer.filter(ImageFilter.GaussianBlur(5))
    return Image.composite(layer, Image.new("RGB", size, "black"), mask)


def render(master: Image.Image, head_cells: list[Image.Image], orb_cells: list[Image.Image], phase: float) -> Image.Image:
    frame = art_camera(master, phase)
    breathing(frame, master, phase)
    hand_float(frame, master, phase)
    scarf_ripple(frame, phase)
    eye_animation(frame, master, phase)
    heat_shimmer(frame, phase)

    head = loop_frame(head_cells, phase).resize((250, 281), Image.Resampling.LANCZOS)
    head = ImageEnhance.Brightness(head).enhance(0.88 + 0.12 * math.sin(phase * math.tau) ** 2)
    screen(frame, head, (387, 26), 0.93)

    orb = loop_frame(orb_cells, phase).resize((330, 371), Image.Resampling.LANCZOS)
    screen(frame, orb, (176, 682), 0.88)

    fire_pulse = 0.56 + 0.24 * math.sin(phase * math.tau) ** 2
    screen(frame, radial_glow(frame.size, (342, 866), 205, fire_pulse), amount=0.78)
    screen(frame, radial_glow(frame.size, (512, 283), 150, 0.34 + fire_pulse * 0.25), amount=0.65)
    for depth in range(3):
        screen(frame, embers(frame.size, phase, depth), amount=0.9)
    screen(frame, border_glint(frame.size, phase), amount=0.76)
    return frame


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--master", required=True, type=Path)
    parser.add_argument("--head-flames", required=True, type=Path)
    parser.add_argument("--orb", required=True, type=Path)
    parser.add_argument("--webp", required=True, type=Path)
    parser.add_argument("--gif", required=True, type=Path)
    parser.add_argument("--sheet", required=True, type=Path)
    parser.add_argument("--frames", type=int, default=48)
    args = parser.parse_args()

    master = Image.open(args.master).convert("RGB")
    head_cells = cells(Image.open(args.head_flames).convert("RGB"))
    orb_cells = cells(Image.open(args.orb).convert("RGB"))
    web_frames: list[Image.Image] = []
    runtime_frames: list[Image.Image] = []
    for index in range(args.frames):
        frame = render(master, head_cells, orb_cells, index / args.frames)
        web_frames.append(frame.resize((512, 768), Image.Resampling.LANCZOS))
        runtime_frames.append(frame.resize((384, 576), Image.Resampling.LANCZOS))

    duration = round(4000 / args.frames)
    args.webp.parent.mkdir(parents=True, exist_ok=True)
    web_frames[0].save(args.webp, save_all=True, append_images=web_frames[1:], duration=duration, loop=0, quality=86, method=5)
    runtime_frames[0].save(args.gif, save_all=True, append_images=runtime_frames[1:], duration=duration, loop=0, optimize=True, disposal=2)

    sheet = Image.new("RGB", (384 * 8, 576 * 6), "black")
    for index, frame in enumerate(runtime_frames):
        sheet.paste(frame, ((index % 8) * 384, (index // 8) * 576))
    sheet.save(args.sheet, format="WEBP", quality=84, method=6)


if __name__ == "__main__":
    main()
