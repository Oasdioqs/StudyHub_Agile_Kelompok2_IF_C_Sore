"""
Generate StudyHub icons in all required sizes using PIL.
Draws a book+spark logo matching the SVG design.
"""
from PIL import Image, ImageDraw, ImageFilter
import os, math

OUTPUT_DIR = "public/icons"
os.makedirs(OUTPUT_DIR, exist_ok=True)

SIZES = {
    "favicon-16.png":  16,
    "favicon-32.png":  32,
    "icon-72.png":     72,
    "icon-96.png":     96,
    "icon-144.png":    144,
    "icon-180.png":    180,
    "icon-192.png":    192,
    "icon-512.png":    512,
    "apple-touch-icon.png": 180,
    "badge-72.png":    72,
}

def lerp_color(c1, c2, t):
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))

def draw_icon(size):
    scale = size / 48.0
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = max(1, int(2 * scale))

    # Draw rounded background square with gradient simulation
    bg_r = int(10 * scale)
    bg_rect = [0, 0, size - 1, size - 1]

    # Draw gradient background (indigo to violet) via multiple bands
    color_a = (79, 70, 229)   # #4f46e5
    color_b = (124, 58, 237)  # #7c3aed
    steps = size
    for i in range(steps):
        t = i / max(steps - 1, 1)
        c = lerp_color(color_a, color_b, t)
        draw.line([(i, 0), (i, size)], fill=c + (255,))

    # Rounded corners mask
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=bg_r, fill=255)
    img.putalpha(mask)

    draw = ImageDraw.Draw(img)

    # Book left page
    lx0 = int(6 * scale) + pad
    ly0 = int(7 * scale)
    lx1 = int(22 * scale)
    ly1 = int(38 * scale)
    left_color = (130, 140, 255, 230)
    draw.rectangle([lx0, ly0, lx1, ly1], fill=left_color)

    # Book right page
    rx0 = int(26 * scale)
    ry0 = int(7 * scale)
    rx1 = int(42 * scale) - pad
    ry1 = int(38 * scale)
    right_color = (180, 160, 255, 200)
    draw.rectangle([rx0, ry0, rx1, ry1], fill=right_color)

    # Book base
    bx0 = lx0
    by0 = int(38 * scale)
    bx1 = rx1
    by1 = int(40 * scale)
    draw.rectangle([bx0, by0, bx1, by1], fill=(130, 140, 255, 140))

    # Spine
    sx0 = int(22 * scale)
    sy0 = int(7 * scale)
    sx1 = int(26 * scale)
    sy1 = int(38 * scale)
    draw.rectangle([sx0, sy0, sx1, sy1], fill=(255, 255, 255, 70))

    # Lightning bolt (spark) — polygon
    # Source pts from SVG: M27.5 14L21 24H25.5L20.5 34L30 22H25L27.5 14Z
    raw_pts = [(27.5, 14), (21, 24), (25.5, 24), (20.5, 34), (30, 22), (25, 22)]
    pts = [(int(x * scale), int(y * scale)) for x, y in raw_pts]
    draw.polygon(pts, fill=(255, 255, 255, 245))

    return img

def generate_all():
    base_512 = draw_icon(512)

    for filename, size in SIZES.items():
        if size == 512:
            img = base_512
        else:
            img = base_512.resize((size, size), Image.LANCZOS)

        out_path = os.path.join(OUTPUT_DIR, filename)
        img.save(out_path, "PNG")
        print(f"  Generated: {filename} ({size}x{size})")

    # Also generate favicon.ico (multi-size)
    ico_sizes = [(16, 16), (32, 32), (48, 48)]
    ico_imgs = [base_512.resize(s, Image.LANCZOS) for s in ico_sizes]
    ico_path = os.path.join(OUTPUT_DIR, "favicon.ico")
    ico_imgs[0].save(ico_path, format="ICO", sizes=ico_sizes)
    print(f"  Generated: favicon.ico (multi-size 16/32/48)")

    # Also save main logo to public/logo.png (512)
    base_512.save("public/logo.png", "PNG")
    print(f"  Generated: public/logo.png (512x512)")

if __name__ == "__main__":
    print("Generating StudyHub icons...")
    generate_all()
    print("Done!")
