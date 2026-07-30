from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
CHARACTERS = ("gojo", "mob", "hit", "ryuk", "maki")


def build_portrait(character: str) -> None:
    source = ROOT / "assets" / "characters" / character / "selection-splash.png"
    image = Image.open(source).convert("RGBA")
    alpha = image.getchannel("A")
    bbox = alpha.getbbox() or (0, 0, image.width, image.height)
    left, top, right, bottom = bbox
    subject_width = right - left
    subject_height = bottom - top

    # A roster tile should read as a face/shoulders portrait, not a tiny full body.
    crop_size = int(max(subject_width * 0.68, subject_height * 0.38))
    center_x = (left + right) // 2
    crop_top = max(0, top - int(crop_size * 0.04))
    crop_left = max(0, center_x - crop_size // 2)
    crop_right = min(image.width, crop_left + crop_size)
    crop_bottom = min(image.height, crop_top + crop_size)
    crop = image.crop((crop_left, crop_top, crop_right, crop_bottom))

    canvas = Image.new("RGBA", (512, 512), (3, 7, 18, 255))
    backdrop = crop.resize((512, 512), Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(18))
    backdrop = ImageEnhance.Brightness(backdrop).enhance(0.42)
    canvas.alpha_composite(backdrop)

    fitted = crop.copy()
    fitted.thumbnail((490, 490), Image.Resampling.LANCZOS)
    x = (512 - fitted.width) // 2
    y = max(8, 512 - fitted.height)
    canvas.alpha_composite(fitted, (x, y))
    canvas.save(source.with_name("portrait.png"), optimize=True)


for name in CHARACTERS:
    build_portrait(name)
