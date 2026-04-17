"""
Generate StudyHub icons — desain baru: huruf S minimalis di background gradient ungu
"""
from PIL import Image, ImageDraw, ImageFont
import os, math

OUTPUT_DIR = "public/icons"
os.makedirs(OUTPUT_DIR, exist_ok=True)

SIZES = {
    "favicon-16.png":       16,
    "favicon-32.png":       32,
    "icon-72.png":          72,
    "icon-96.png":          96,
    "icon-144.png":         144,
    "icon-180.png":         180,
    "icon-192.png":         192,
    "icon-512.png":         512,
    "apple-touch-icon.png": 180,
    "badge-72.png":         72,
}

COLOR_A = (79, 70, 229)    # #4f46e5 indigo
COLOR_B = (124, 58, 237)   # #7c3aed purple

def lerp_color(c1, c2, t):
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))

def draw_rounded_rect_gradient(draw, img, size, radius):
    """Draw diagonal gradient background with rounded corners."""
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            c = lerp_color(COLOR_A, COLOR_B, min(t * 1.4, 1.0))
            img.putpixel((x, y), c + (255,))

    # Apply rounded corners mask
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    img.putalpha(mask)

def draw_s_stroke(draw, size):
    """Draw the letter S as a thick rounded stroke."""
    # Scale factor relative to reference 48x48 design
    scale = size / 48.0
    sw = max(2, int(4.8 * scale))  # stroke width

    # S path: top arc → middle → bottom arc
    # Reference points in 48x48 space
    points_top = [
        (33 * scale, 14 * scale),   # start: top-right
        (33 * scale, 7 * scale),    # control 1
        (14 * scale, 7 * scale),    # control 2
        (14 * scale, 17 * scale),   # end: top-left
    ]
    points_mid = [
        (14 * scale, 17 * scale),   # start
        (14 * scale, 24 * scale),   # control 1
        (34 * scale, 22 * scale),   # control 2
        (34 * scale, 31 * scale),   # end: bottom-right
    ]
    points_bot = [
        (34 * scale, 31 * scale),   # start
        (34 * scale, 41 * scale),   # control 1
        (15 * scale, 41 * scale),   # control 2
        (15 * scale, 34 * scale),   # end: bottom-left
    ]

    white = (255, 255, 255, 248)

    def draw_bezier(p0, p1, p2, p3, steps=60):
        """Draw cubic bezier as line segments."""
        prev = None
        for i in range(steps + 1):
            t = i / steps
            mt = 1 - t
            x = mt**3*p0[0] + 3*mt**2*t*p1[0] + 3*mt*t**2*p2[0] + t**3*p3[0]
            y = mt**3*p0[1] + 3*mt**2*t*p1[1] + 3*mt*t**2*p2[1] + t**3*p3[1]
            if prev:
                draw.line([prev, (x, y)], fill=white, width=sw)
            prev = (x, y)

    draw_bezier(*points_top)
    draw_bezier(*points_mid)
    draw_bezier(*points_bot)

    # Round caps at start and end
    r = sw // 2
    sx, sy = points_top[0]
    draw.ellipse([sx-r, sy-r, sx+r, sy+r], fill=white)
    ex, ey = points_bot[3]
    draw.ellipse([ex-r, ey-r, ex+r, ey+r], fill=white)

def add_shine(img, size):
    """Add subtle glass shine at top."""
    shine = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shine)
    for y in range(size // 2):
        alpha = int(38 * (1 - y / (size / 2)))
        sd.line([(0, y), (size, y)], fill=(255, 255, 255, alpha))
    # Rounded top mask
    smask = Image.new("L", (size, size), 0)
    smd = ImageDraw.Draw(smask)
    r = max(4, int(10 * size / 48))
    smd.rounded_rectangle([0, 0, size - 1, size // 2], radius=r, fill=255)
    shine.putalpha(smask)
    img.alpha_composite(shine)

def draw_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = max(4, int(12 * size / 48))
    draw_rounded_rect_gradient(draw, img, size, radius)
    add_shine(img, size)

    draw = ImageDraw.Draw(img)
    draw_s_stroke(draw, size)

    # Small accent dot (only at larger sizes)
    if size >= 64:
        scale = size / 48.0
        dr = max(2, int(1.8 * scale))
        dx, dy = int(39 * scale), int(9 * scale)
        draw.ellipse([dx-dr, dy-dr, dx+dr, dy+dr], fill=(255, 255, 255, 110))

    return img

def generate_all():
    print("Generating StudyHub icons (desain S baru)...")
    base_512 = draw_icon(512)

    for filename, size in SIZES.items():
        img = base_512.resize((size, size), Image.LANCZOS) if size != 512 else base_512
        out = os.path.join(OUTPUT_DIR, filename)
        img.save(out, "PNG")
        print(f"  ✓ {filename} ({size}x{size})")

    # favicon.ico multi-size
    ico_imgs = [base_512.resize((s, s), Image.LANCZOS) for s in [16, 32, 48]]
    ico_path = os.path.join(OUTPUT_DIR, "favicon.ico")
    ico_imgs[0].save(ico_path, format="ICO", sizes=[(16,16),(32,32),(48,48)])
    print(f"  ✓ favicon.ico (16/32/48)")

    base_512.save("public/logo.png", "PNG")
    print(f"  ✓ public/logo.png (512x512)")
    print("Selesai!")

if __name__ == "__main__":
    generate_all()
