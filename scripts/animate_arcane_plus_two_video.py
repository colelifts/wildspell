"""Composite a user-supplied MP4 into the premium Arcane +2 card package.

Requires imageio and imageio-ffmpeg in addition to Pillow.
"""

from __future__ import annotations

import argparse
import math
import random
from pathlib import Path

import imageio.v2 as imageio
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps


ART_BOX = (47, 72, 977, 1078)


def screen(base: Image.Image, layer: Image.Image, amount: float = 1.0) -> None:
    mixed = ImageChops.screen(base.convert("RGB"), layer.convert("RGB"))
    base.paste(mixed if amount >= 1 else Image.blend(base, mixed, amount))


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


def fit_video_frame(frame: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Crop around the face and casting hands, then apply a restrained violet grade."""
    crop_top = round(frame.height * 0.105)
    crop_bottom = round(frame.height * 0.79)
    cropped = frame.crop((0, crop_top, frame.width, crop_bottom))
    target_ratio = size[0] / size[1]
    current_ratio = cropped.width / cropped.height
    if current_ratio < target_ratio:
        target_height = round(cropped.width / target_ratio)
        top = max(0, (cropped.height - target_height) // 2)
        cropped = cropped.crop((0, top, cropped.width, top + target_height))
    else:
        target_width = round(cropped.height * target_ratio)
        left = (cropped.width - target_width) // 2
        cropped = cropped.crop((left, 0, left + target_width, cropped.height))
    art = cropped.resize(size, Image.Resampling.LANCZOS)
    tint = ImageOps.colorize(ImageOps.grayscale(art), (2, 4, 24), (120, 195, 255))
    return Image.blend(art, tint, 0.11)


def ui_mask(size: tuple[int, int]) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rectangle((0, 0, size[0], 72), fill=255)
    draw.rectangle((0, 0, 64, size[1]), fill=255)
    draw.rectangle((960, 0, size[0], size[1]), fill=255)
    draw.rectangle((0, 1042, size[0], size[1]), fill=255)
    draw.ellipse((20, 28, 265, 270), fill=255)
    draw.ellipse((760, 25, 1006, 265), fill=255)
    return mask.filter(ImageFilter.GaussianBlur(1.2))


def card_sprite(phase: float, variant: int) -> Image.Image:
    width, height = 142, 210
    sprite = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(sprite)
    pulse = 0.72 + 0.28 * math.sin(phase * math.tau + variant * math.pi) ** 2
    outer = (round(100 * pulse), round(75 * pulse), round(255 * pulse))
    inner = (round(55 * pulse), round(210 * pulse), round(255 * pulse))
    draw.rounded_rectangle((7, 7, width - 8, height - 8), radius=15, fill=(5, 4, 28, 205), outline=outer + (255,), width=8)
    draw.rounded_rectangle((17, 17, width - 18, height - 18), radius=11, outline=inner + (255,), width=3)
    draw.ellipse((36, 60, 106, 130), outline=outer + (255,), width=5)
    draw.ellipse((48, 72, 94, 118), outline=inner + (255,), width=3)
    draw.line((37, 145, 105, 145), fill=inner + (255,), width=4)
    draw.line((50, 160, 92, 160), fill=outer + (255,), width=3)
    return sprite


def spectral_cards(size: tuple[int, int], phase: float) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    placements = [
        (258 + math.sin(phase * math.tau) * 18, 280 + math.cos(phase * math.tau) * 14, -18 + math.sin(phase * math.tau) * 4),
        (725 - math.sin(phase * math.tau) * 18, 310 - math.cos(phase * math.tau) * 14, 18 - math.sin(phase * math.tau) * 4),
    ]
    for variant, (x, y, angle) in enumerate(placements):
        sprite = card_sprite(phase, variant).rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
        layer.alpha_composite(sprite, (round(x - sprite.width / 2), round(y - sprite.height / 2)))
    return layer


def spell_rings(size: tuple[int, int], phase: float) -> Image.Image:
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    center = (520, 700)
    for index, radius in enumerate((105, 155, 215, 285)):
        angle = phase * 360 * (1 if index % 2 == 0 else -1) + index * 37
        color = ((65, 205, 255), (105, 65, 255))[index % 2]
        box = (center[0] - radius, center[1] - radius * 0.52, center[0] + radius, center[1] + radius * 0.52)
        for offset in (0, 128, 248):
            draw.arc(box, start=angle + offset, end=angle + offset + 54, fill=color, width=2 + index % 2)
    return layer.filter(ImageFilter.GaussianBlur(2.5))


def cosmic_particles(size: tuple[int, int], phase: float, depth: int) -> Image.Image:
    rng = random.Random(20202 + depth)
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    count = (42, 27, 15)[depth]
    speed = (95, 155, 230)[depth]
    for index in range(count):
        x0 = rng.randint(70, size[0] - 70)
        y0 = rng.randint(80, 1040)
        y = 80 + ((y0 - 80 - phase * speed) % 960)
        x = x0 + math.sin(phase * math.tau + index * 0.93) * (4 + depth * 8)
        twinkle = 0.3 + 0.7 * math.sin(phase * math.tau + index * 0.71) ** 2
        radius = 1 + depth + rng.choice((0, 0, 1))
        color = (round(75 * twinkle), round(145 * twinkle), round(255 * twinkle))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
    return layer.filter(ImageFilter.GaussianBlur(0.3 + depth * 0.45))


def hand_charge(size: tuple[int, int], phase: float) -> Image.Image:
    layer = Image.new("RGB", size, "black")
    draw = ImageDraw.Draw(layer)
    pulse = 0.48 + 0.52 * math.sin(phase * math.tau) ** 2
    for x, y, radius, strength in ((520, 705, 115, 1.0), (390, 620, 80, 0.7), (645, 630, 80, 0.7)):
        color = (round(35 * pulse * strength), round(120 * pulse * strength), round(230 * pulse * strength))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
    return layer.filter(ImageFilter.GaussianBlur(42))


def foil_glint(master: Image.Image, phase: float) -> Image.Image:
    beam = Image.new("L", master.size, 0)
    travel = -430 + phase * 1920
    ImageDraw.Draw(beam).polygon([(travel, 1550), (travel + 90, 1550), (travel + 560, -20), (travel + 470, -20)], fill=220)
    beam = beam.filter(ImageFilter.GaussianBlur(20))
    detail = ImageOps.grayscale(master).point(lambda value: max(0, min(255, (value - 100) * 2)))
    mask = ImageChops.multiply(beam, detail)
    return Image.composite(Image.new("RGB", master.size, (95, 110, 255)), Image.new("RGB", master.size, "black"), mask)


def render(master: Image.Image, video_frame: Image.Image, phase: float, overlay_mask: Image.Image) -> Image.Image:
    frame = master.copy()
    art = fit_video_frame(video_frame, (ART_BOX[2] - ART_BOX[0], ART_BOX[3] - ART_BOX[1]))
    art_mask = Image.new("L", art.size, 0)
    ImageDraw.Draw(art_mask).rounded_rectangle((0, 0, art.width - 1, art.height - 1), radius=24, fill=255)
    frame.paste(art, ART_BOX[:2], art_mask)
    screen(frame, hand_charge(frame.size, phase), 0.62)
    screen(frame, spell_rings(frame.size, phase), 0.66)
    frame = Image.alpha_composite(frame.convert("RGBA"), spectral_cards(frame.size, phase)).convert("RGB")
    for depth in range(3):
        screen(frame, cosmic_particles(frame.size, phase, depth), 0.78)
    # Restore all frame UI above the moving artwork, including the exact text.
    frame.paste(master, (0, 0), overlay_mask)
    screen(frame, foil_glint(master, phase), 0.32)
    return ImageEnhance.Contrast(frame).enhance(1.012)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--master", required=True, type=Path)
    parser.add_argument("--video", required=True, type=Path)
    parser.add_argument("--webp", required=True, type=Path)
    parser.add_argument("--gif", required=True, type=Path)
    parser.add_argument("--sheet", required=True, type=Path)
    parser.add_argument("--frames", type=int, default=48)
    args = parser.parse_args()

    master = Image.open(args.master).convert("RGB")
    mask = ui_mask(master.size)
    reader = imageio.get_reader(str(args.video), format="ffmpeg")
    metadata = reader.get_meta_data()
    fps = float(metadata.get("fps", 30))
    safe_last = max(1, round(float(metadata.get("duration", 4)) * fps) - 7)
    first_video = Image.fromarray(reader.get_data(0)).convert("RGB")

    web_frames: list[Image.Image] = []
    runtime_frames: list[Image.Image] = []
    for index in range(args.frames):
        phase = index / args.frames
        # A cosine shuttle makes arbitrary source video loop perfectly without a jump.
        video_phase = 0.5 - 0.5 * math.cos(phase * math.tau)
        source_index = round(video_phase * safe_last)
        video_frame = first_video if source_index == 0 else Image.fromarray(reader.get_data(source_index)).convert("RGB")
        frame = render(master, video_frame, phase, mask)
        web_frames.append(frame.resize((512, 768), Image.Resampling.LANCZOS))
        runtime_frames.append(frame.resize((384, 576), Image.Resampling.LANCZOS))
    reader.close()

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
